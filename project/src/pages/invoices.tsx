import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { fetchInvoices, fetchInvoice } from '@/lib/api';
import { Button, Input, Textarea, Select, Card, Badge, Modal, PageHeader, EmptyState, Spinner } from '@/components/ui';
import { formatCurrency, formatDate, generateIdempotencyKey, cn } from '@/lib/utils';
import { Plus, Search, FileText, ArrowLeft, Printer, DollarSign, Send, Wallet } from 'lucide-react';
import type { InvoiceStatus, Customer, Product, Invoice, Payment, SolanaPaymentRecord } from '@/lib/types';

const statusBadges: Record<InvoiceStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'default', issued: 'info', partially_paid: 'warning', paid: 'success', overdue: 'error', cancelled: 'default',
};

export function InvoicesPage() {
  const { business } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['invoices', search, page], queryFn: () => fetchInvoices(search, page, 20) });
  const invoices = data?.data ?? [];

  return (
    <div>
      <PageHeader title="Invoices" description="Create and track customer invoices" action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create Invoice</Button>} />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" placeholder="Search invoices..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> :
        invoices.length === 0 ? <Card><EmptyState icon={FileText} title="No invoices yet" description="Create your first invoice to bill a customer." action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create Invoice</Button>} /></Card> :
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="text-left px-4 py-3 font-medium text-slate-600">Number</th><th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th><th className="text-left px-4 py-3 font-medium text-slate-600">Status</th><th className="text-left px-4 py-3 font-medium text-slate-600">Due</th><th className="text-right px-4 py-3 font-medium text-slate-600">Total</th><th className="text-right px-4 py-3 font-medium text-slate-600">Due Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link to={`/app/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-blue-600">{inv.invoice_number}</Link></td><td className="px-4 py-3 text-slate-600">{inv.customer?.name ?? '—'}</td><td className="px-4 py-3"><Badge variant={statusBadges[inv.status]}>{inv.status.replace('_', ' ')}</Badge></td><td className="px-4 py-3 text-slate-500">{formatDate(inv.due_date)}</td><td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(inv.total_amount, business?.currency)}</td><td className="px-4 py-3 text-right">{inv.amount_due > 0 ? <span className="text-amber-600 font-medium">{formatCurrency(inv.amount_due, business?.currency)}</span> : <span className="text-emerald-600">Paid</span>}</td></tr>
              ))}
            </tbody>
          </table>
          {data && data.total > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">Page {page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
        </Card>
      }
      <CreateInvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

interface LineItemInput { product_id: string; description: string; quantity: string; unit_price: string; }

function CreateInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<LineItemInput[]>([{ product_id: '', description: '', quantity: '1', unit_price: '0' }]);
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const total = subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0);

  const onProductChange = (idx: number, pid: string) => {
    const p = products?.find((x) => x.id === pid);
    setItems(items.map((it, i) => i === idx ? { ...it, product_id: pid, description: p?.name ?? '', unit_price: p ? String(p.selling_price) : '0' } : it));
  };

  const handleCreate = async () => {
    if (!customerId) { toast('Select a customer', 'error'); return; }
    const validItems = items.filter((it) => it.description && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { toast('Add at least one line item', 'error'); return; }
    setSaving(true);
    try {
      const invNumber = 'INV-' + Date.now().toString().slice(-8);
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        business_id: business?.id, customer_id: customerId, invoice_number: invNumber,
        status: 'draft', subtotal, tax_amount: parseFloat(tax) || 0, discount_amount: parseFloat(discount) || 0,
        total_amount: total, amount_paid: 0, amount_due: total,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        notes,
      }).select().single();
      if (invErr) throw invErr;
      const itemRows = validItems.map((it) => ({
        invoice_id: inv.id, product_id: it.product_id || null, description: it.description,
        quantity: parseFloat(it.quantity), unit_price: parseFloat(it.unit_price),
        line_total: parseFloat(it.quantity) * parseFloat(it.unit_price),
      }));
      const { error: itemsErr } = await supabase.from('invoice_items').insert(itemRows);
      if (itemsErr) throw itemsErr;
      toast('Invoice created', 'success');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
      navigate(`/app/invoices/${inv.id}`);
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Invoice" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Select...</option>{customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex justify-between items-center"><h3 className="font-semibold text-slate-900">Line Items</h3><Button size="sm" variant="outline" onClick={() => setItems([...items, { product_id: '', description: '', quantity: '1', unit_price: '0' }])}><Plus className="h-3.5 w-3.5" /> Add</Button></div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4"><Select value={it.product_id} onChange={(e) => onProductChange(idx, e.target.value)}><option value="">Custom item...</option>{products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
              <div className="col-span-3"><Input value={it.description} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Description" /></div>
              <div className="col-span-2"><Input type="number" value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} placeholder="Qty" /></div>
              <div className="col-span-2"><Input type="number" value={it.unit_price} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} placeholder="Price" /></div>
              <div className="col-span-1">{items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Plus className="h-4 w-4 rotate-45" /></button>}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
          <Input label="Discount" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <Input label="Tax" type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
          <div className="col-span-2 flex justify-between text-sm border-t border-slate-100 pt-2"><span className="font-medium">Total</span><span className="font-bold text-slate-900">{formatCurrency(total, business?.currency)}</span></div>
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create Invoice</Button></div>
    </Modal>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({ queryKey: ['invoice', id], queryFn: () => fetchInvoice(id!), enabled: !!id });
  const { data: payments } = useQuery({
    queryKey: ['invoice-payments', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('*').eq('invoice_id', id!).order('paid_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
    enabled: !!id,
  });
  const { data: solanaRecords } = useQuery({
    queryKey: ['solana-records', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('solana_payment_records').select('*').eq('invoice_id', id!);
      if (error) throw error;
      return (data ?? []) as SolanaPaymentRecord[];
    },
    enabled: !!id,
  });

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!invoice) return <p className="text-slate-500">Invoice not found.</p>;
  const inv = invoice as Invoice;

  const handleIssue = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('invoices').update({ status: 'issued', updated_at: new Date().toISOString() }).eq('id', inv.id);
      if (error) throw error;
      toast('Invoice issued', 'success');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handlePayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('record_customer_payment', {
        p_customer_id: inv.customer_id, p_amount: amt, p_payment_method: payMethod,
        p_invoice_id: inv.id, p_notes: 'Invoice payment', p_idempotency_key: generateIdempotencyKey(),
      });
      if (error) throw error;
      toast('Payment recorded', 'success'); setPayOpen(false); setPayAmount('');
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Link to="/app/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Invoices</Link>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 print:shadow-none print:border-0">
            <div className="flex items-start justify-between print:hidden">
              <div><h1 className="text-xl font-bold text-slate-900">{inv.invoice_number}</h1><p className="text-sm text-slate-500">{inv.customer?.name ?? '—'}</p></div>
              <div className="flex items-center gap-2"><Badge variant={statusBadges[inv.status]}>{inv.status.replace('_', ' ')}</Badge></div>
            </div>
            <div className="hidden print:block mb-6"><h1 className="text-2xl font-bold">Invoice {inv.invoice_number}</h1><p className="text-slate-600">{business?.name}</p></div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 print:mt-6">
              <div><p className="text-xs text-slate-500">Issue Date</p><p className="text-sm font-medium">{formatDate(inv.issue_date)}</p></div>
              <div><p className="text-xs text-slate-500">Due Date</p><p className="text-sm font-medium">{formatDate(inv.due_date)}</p></div>
              <div><p className="text-xs text-slate-500">Customer</p><p className="text-sm font-medium">{inv.customer?.name}</p></div>
              <div><p className="text-xs text-slate-500">Status</p><Badge variant={statusBadges[inv.status]}>{inv.status.replace('_', ' ')}</Badge></div>
            </div>
          </Card>

          {inv.items && inv.items.length > 0 && (
            <Card className="overflow-hidden print:shadow-none">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 print:bg-transparent"><tr><th className="text-left px-4 py-3 font-medium text-slate-600">Description</th><th className="text-right px-4 py-3 font-medium text-slate-600">Qty</th><th className="text-right px-4 py-3 font-medium text-slate-600">Price</th><th className="text-right px-4 py-3 font-medium text-slate-600">Total</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{inv.items.map((it) => (<tr key={it.id}><td className="px-4 py-3 text-slate-700">{it.description}</td><td className="px-4 py-3 text-right text-slate-600">{it.quantity}</td><td className="px-4 py-3 text-right text-slate-600">{formatCurrency(it.unit_price, business?.currency)}</td><td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(it.line_total, business?.currency)}</td></tr>))}</tbody>
              </table>
            </Card>
          )}

          {payments && payments.length > 0 && (
            <Card className="p-5 print:hidden">
              <h3 className="font-semibold text-slate-900 mb-3">Payment History</h3>
              <div className="space-y-2">{payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-medium text-slate-700">{formatCurrency(p.amount, business?.currency)} - {p.payment_method}</p><p className="text-xs text-slate-400">{formatDate(p.paid_at)}</p></div><Badge variant={p.status === 'completed' ? 'success' : 'warning'}>{p.status}</Badge></div>
              ))}</div>
            </Card>
          )}

          {solanaRecords && solanaRecords.length > 0 && (
            <Card className="p-5 print:hidden border-indigo-200">
              <h3 className="font-semibold text-slate-900 mb-3">Solana Payment Records</h3>
              <div className="space-y-2">{solanaRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div><p className="text-sm font-medium text-slate-700">{formatCurrency(r.expected_amount, business?.currency)} - {r.network}</p><p className="text-xs text-slate-400">{r.transaction_signature ? `Sig: ${r.transaction_signature.slice(0, 20)}...` : 'No signature'}</p></div>
                  <Badge variant={r.status === 'verified' ? 'success' : r.status === 'simulated' ? 'warning' : 'info'}>{r.status}</Badge>
                </div>
              ))}</div>
            </Card>
          )}
        </div>

        <div className="space-y-4 print:hidden">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-900">{formatCurrency(inv.subtotal, business?.currency)}</span></div>
              {inv.discount_amount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-red-600">-{formatCurrency(inv.discount_amount, business?.currency)}</span></div>}
              {inv.tax_amount > 0 && <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="text-slate-900">+{formatCurrency(inv.tax_amount, business?.currency)}</span></div>}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-medium"><span className="text-slate-700">Total</span><span className="text-slate-900">{formatCurrency(inv.total_amount, business?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="text-emerald-600">{formatCurrency(inv.amount_paid, business?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Due</span><span className={cn('font-bold', inv.amount_due > 0 ? 'text-amber-600' : 'text-emerald-600')}>{formatCurrency(inv.amount_due, business?.currency)}</span></div>
            </div>
            <div className="mt-4 space-y-2">
              {inv.status === 'draft' && <Button className="w-full" loading={saving} onClick={handleIssue}><Send className="h-4 w-4" /> Issue Invoice</Button>}
              {inv.amount_due > 0 && inv.status !== 'draft' && inv.status !== 'cancelled' && (
                <>
                  <Button className="w-full" onClick={() => setPayOpen(true)}><DollarSign className="h-4 w-4" /> Record Payment</Button>
                  <Link to={`/app/invoices/${inv.id}/pay`}><Button variant="outline" className="w-full"><Wallet className="h-4 w-4" /> Pay with Solana</Button></Link>
                </>
              )}
              <Button variant="ghost" className="w-full" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            </div>
          </Card>
        </div>
      </div>
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment" size="sm">
        <div className="space-y-4">
          <Input label="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(inv.amount_due)} />
          <Select label="Payment Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="card">Card</option><option value="other">Other</option></Select>
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button><Button loading={saving} onClick={handlePayment}>Record Payment</Button></div>
      </Modal>
    </div>
  );
}
