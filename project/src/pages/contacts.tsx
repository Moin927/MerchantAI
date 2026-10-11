import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { fetchCustomers, fetchCustomer, fetchSuppliers, fetchSupplier, callRpc } from '@/lib/api';
import { Button, Input, Textarea, Select, Card, Modal, PageHeader, EmptyState, Spinner } from '@/components/ui';
import { formatCurrency, formatDate, generateIdempotencyKey } from '@/lib/utils';
import { Plus, Search, Users, Truck, ArrowLeft, Phone, Mail, MapPin, DollarSign } from 'lucide-react';
import type { Transaction } from '@/lib/types';

interface ContactForm { name: string; email: string; phone: string; address: string; notes: string; }
const emptyForm: ContactForm = { name: '', email: '', phone: '', address: '', notes: '' };

export function CustomersPage() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => fetchCustomers(search, page, 20),
  });

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('customers').insert({
        business_id: business?.id, ...form,
      });
      if (error) throw error;
      toast('Customer added', 'success');
      setModalOpen(false); setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const customers = data?.data ?? [];

  return (
    <div>
      <PageHeader title="Customers" description="Manage your customers and their balances" action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Customer</Button>} />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> :
        customers.length === 0 ? <Card><EmptyState icon={Users} title="No customers yet" description="Add your first customer to start tracking sales and balances." action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Customer</Button>} /></Card> :
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="text-left px-4 py-3 font-medium text-slate-600">Name</th><th className="text-left px-4 py-3 font-medium text-slate-600">Phone</th><th className="text-left px-4 py-3 font-medium text-slate-600">Email</th><th className="text-right px-4 py-3 font-medium text-slate-600">Added</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link to={`/app/customers/${c.id}`} className="font-medium text-slate-900 hover:text-blue-600">{c.name}</Link></td><td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td><td className="px-4 py-3 text-slate-600">{c.email || '—'}</td><td className="px-4 py-3 text-right text-slate-500">{formatDate(c.created_at)}</td></tr>
              ))}
            </tbody>
          </table>
          {data && data.total > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">Page {page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
        </Card>
      }
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Customer"><div className="space-y-4"><Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ahmed Khan" /><Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300-1234567" /><Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /><Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></div></Modal>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({ queryKey: ['customer', id], queryFn: () => fetchCustomer(id!), enabled: !!id });
  const { data: balance } = useQuery({ queryKey: ['customer-balance', id], queryFn: () => callRpc('get_customer_balance', { p_customer_id: id }), enabled: !!id });
  const { data: txns } = useQuery({
    queryKey: ['customer-txns', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('customer_id', id!).order('occurred_at', { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    enabled: !!id,
  });

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!customer) return <p className="text-slate-500">Customer not found.</p>;
  const bal = balance as { balance?: number; total_sales_with_credit?: number; total_payments?: number } | undefined;

  const handlePayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('record_customer_payment', {
        p_customer_id: customer.id, p_amount: amt, p_payment_method: payMethod,
        p_notes: payNotes, p_idempotency_key: generateIdempotencyKey(),
      });
      if (error) throw error;
      toast('Payment recorded', 'success');
      setPayOpen(false); setPayAmount(''); setPayNotes('');
      queryClient.invalidateQueries({ queryKey: ['customer-balance', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-txns', id] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Link to="/app/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Customers</Link>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
            <div className="mt-4 space-y-2">
              {customer.phone && <p className="text-sm text-slate-600 flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {customer.phone}</p>}
              {customer.email && <p className="text-sm text-slate-600 flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {customer.email}</p>}
              {customer.address && <p className="text-sm text-slate-600 flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {customer.address}</p>}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Transaction History</h2>
            {txns && txns.length > 0 ? <div className="space-y-2">{txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-medium text-slate-700">{t.transaction_number}</p><p className="text-xs text-slate-400 capitalize">{t.transaction_type.replace('_', ' ')} - {formatDate(t.occurred_at)}</p></div><span className="text-sm font-semibold text-slate-900">{formatCurrency(t.total_amount, business?.currency)}</span></div>
            ))}</div> : <p className="text-sm text-slate-400 py-4">No transactions yet.</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Outstanding Balance</h3>
            <p className={`text-3xl font-bold ${(bal?.balance ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(bal?.balance ?? 0, business?.currency)}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total Credit Sales</span><span className="text-slate-900">{formatCurrency(bal?.total_sales_with_credit ?? 0, business?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Payments</span><span className="text-slate-900">{formatCurrency(bal?.total_payments ?? 0, business?.currency)}</span></div>
            </div>
            <Button className="w-full mt-4" onClick={() => setPayOpen(true)}><DollarSign className="h-4 w-4" /> Record Payment</Button>
          </Card>
        </div>
      </div>
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Customer Payment" size="sm">
        <div className="space-y-4">
          <Input label="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
          <Select label="Payment Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="card">Card</option><option value="other">Other</option></Select>
          <Input label="Notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button><Button loading={saving} onClick={handlePayment}>Record Payment</Button></div>
      </Modal>
    </div>
  );
}

export function SuppliersPage() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['suppliers', search, page], queryFn: () => fetchSuppliers(search, page, 20) });

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('suppliers').insert({ business_id: business?.id, ...form });
      if (error) throw error;
      toast('Supplier added', 'success'); setModalOpen(false); setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const suppliers = data?.data ?? [];
  return (
    <div>
      <PageHeader title="Suppliers" description="Manage your suppliers and track payables" action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Supplier</Button>} />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" placeholder="Search suppliers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> :
        suppliers.length === 0 ? <Card><EmptyState icon={Truck} title="No suppliers yet" description="Add your first supplier to start tracking purchases." action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Supplier</Button>} /></Card> :
        <Card className="overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-slate-50 border-b border-slate-200"><tr><th className="text-left px-4 py-3 font-medium text-slate-600">Name</th><th className="text-left px-4 py-3 font-medium text-slate-600">Phone</th><th className="text-left px-4 py-3 font-medium text-slate-600">Email</th><th className="text-right px-4 py-3 font-medium text-slate-600">Added</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{suppliers.map((s) => (<tr key={s.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link to={`/app/suppliers/${s.id}`} className="font-medium text-slate-900 hover:text-blue-600">{s.name}</Link></td><td className="px-4 py-3 text-slate-600">{s.phone || '—'}</td><td className="px-4 py-3 text-slate-600">{s.email || '—'}</td><td className="px-4 py-3 text-right text-slate-500">{formatDate(s.created_at)}</td></tr>))}</tbody>
          </table>
          {data && data.total > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">Page {page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
        </Card>
      }
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Supplier"><div className="space-y-4"><Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tech Distributors" /><Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /><Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>Save</Button></div></Modal>
    </div>
  );
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: supplier, isLoading } = useQuery({ queryKey: ['supplier', id], queryFn: () => fetchSupplier(id!), enabled: !!id });
  const { data: balance } = useQuery({ queryKey: ['supplier-balance', id], queryFn: () => callRpc('get_supplier_balance', { p_supplier_id: id }), enabled: !!id });
  const { data: txns } = useQuery({
    queryKey: ['supplier-txns', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('supplier_id', id!).order('occurred_at', { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    enabled: !!id,
  });

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!supplier) return <p className="text-slate-500">Supplier not found.</p>;
  const bal = balance as { balance?: number; total_purchases_with_credit?: number; total_payments?: number } | undefined;

  const handlePayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('record_supplier_payment', {
        p_supplier_id: supplier.id, p_amount: amt, p_payment_method: payMethod,
        p_notes: payNotes, p_idempotency_key: generateIdempotencyKey(),
      });
      if (error) throw error;
      toast('Payment recorded', 'success'); setPayOpen(false); setPayAmount(''); setPayNotes('');
      queryClient.invalidateQueries({ queryKey: ['supplier-balance', id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-txns', id] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Link to="/app/suppliers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Suppliers</Link>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h1 className="text-xl font-bold text-slate-900">{supplier.name}</h1>
            <div className="mt-4 space-y-2">
              {supplier.phone && <p className="text-sm text-slate-600 flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {supplier.phone}</p>}
              {supplier.email && <p className="text-sm text-slate-600 flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {supplier.email}</p>}
              {supplier.address && <p className="text-sm text-slate-600 flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {supplier.address}</p>}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Transaction History</h2>
            {txns && txns.length > 0 ? <div className="space-y-2">{txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-medium text-slate-700">{t.transaction_number}</p><p className="text-xs text-slate-400 capitalize">{t.transaction_type.replace('_', ' ')} - {formatDate(t.occurred_at)}</p></div><span className="text-sm font-semibold text-slate-900">{formatCurrency(t.total_amount, business?.currency)}</span></div>
            ))}</div> : <p className="text-sm text-slate-400 py-4">No transactions yet.</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Outstanding Payable</h3>
            <p className={`text-3xl font-bold ${(bal?.balance ?? 0) > 0 ? 'text-purple-600' : 'text-emerald-600'}`}>{formatCurrency(bal?.balance ?? 0, business?.currency)}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total Credit Purchases</span><span className="text-slate-900">{formatCurrency(bal?.total_purchases_with_credit ?? 0, business?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Payments</span><span className="text-slate-900">{formatCurrency(bal?.total_payments ?? 0, business?.currency)}</span></div>
            </div>
            <Button className="w-full mt-4" onClick={() => setPayOpen(true)}><DollarSign className="h-4 w-4" /> Record Payment</Button>
          </Card>
        </div>
      </div>
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Supplier Payment" size="sm">
        <div className="space-y-4">
          <Input label="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
          <Select label="Payment Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="card">Card</option><option value="other">Other</option></Select>
          <Input label="Notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button><Button loading={saving} onClick={handlePayment}>Record Payment</Button></div>
      </Modal>
    </div>
  );
}
