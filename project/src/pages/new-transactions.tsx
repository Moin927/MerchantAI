import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { Button, Input, Textarea, Select, Card, PageHeader } from '@/components/ui';
import { formatCurrency, generateIdempotencyKey, cn } from '@/lib/utils';
import { Plus, Trash2, ShoppingCart, Package as PackageIcon } from 'lucide-react';
import type { Product, Customer, Supplier } from '@/lib/types';

interface LineItem {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export function NewSalePage() {
  const navigate = useNavigate();
  const { business } = useAuth();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', quantity: '1', unit_price: '0' }]);
  const [amountPaid, setAmountPaid] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const total = subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0);
  const due = total - (parseFloat(amountPaid) || 0);

  const addItem = () => setItems([...items, { product_id: '', quantity: '1', unit_price: '0' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const onProductChange = (idx: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    setItems(items.map((it, i) => i === idx ? { ...it, product_id: productId, unit_price: product ? String(product.selling_price) : '0' } : it));
  };

  const handleSubmit = async () => {
    const validItems = items.filter((it) => it.product_id && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { toast('Add at least one product', 'error'); return; }
    setSaving(true);
    try {
      const rpcItems = validItems.map((it) => ({
        product_id: it.product_id,
        quantity: parseFloat(it.quantity),
        unit_price: parseFloat(it.unit_price),
      }));
      const { data, error } = await supabase.rpc('create_sale', {
        p_customer_id: customerId || null,
        p_items: rpcItems,
        p_amount_paid: parseFloat(amountPaid) || 0,
        p_discount_amount: parseFloat(discount) || 0,
        p_tax_amount: parseFloat(tax) || 0,
        p_notes: notes,
        p_idempotency_key: generateIdempotencyKey(),
      });
      if (error) throw error;
      toast('Sale recorded successfully', 'success');
      navigate(`/app/transactions/${data.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to record sale', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="New Sale" description="Record a sale with line items, partial payments, and notes" action={<Button variant="outline" onClick={() => navigate('/app/transactions')}>Cancel</Button>} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <Select label="Customer (optional for cash sales)" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Line Items</h3>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Add Item</Button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select label={idx === 0 ? "Product" : undefined} value={it.product_id} onChange={(e) => onProductChange(idx, e.target.value)}>
                      <option value="">Select product...</option>
                      {products?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.quantity_on_hand} in stock)</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input label={idx === 0 ? "Qty" : undefined} type="number" value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                  </div>
                  <div className="col-span-3">
                    <Input label={idx === 0 ? "Unit Price" : undefined} type="number" value={it.unit_price} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 flex-1">{formatCurrency((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), business?.currency)}</span>
                    {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes about this sale..." />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Payment & Totals</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900">{formatCurrency(subtotal, business?.currency)}</span></div>
              <Input label="Discount" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              <Input label="Tax" type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
              <div className="flex justify-between text-sm border-t border-slate-100 pt-2"><span className="font-medium text-slate-700">Total</span><span className="font-bold text-slate-900">{formatCurrency(total, business?.currency)}</span></div>
              <Input label="Amount Paid" type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Due</span>
                <span className={cn('font-bold', due > 0 ? 'text-amber-600' : 'text-emerald-600')}>{formatCurrency(due, business?.currency)}</span>
              </div>
              {due > 0 && customerId && <p className="text-xs text-slate-400">Outstanding balance will be tracked for this customer.</p>}
              {due > 0 && !customerId && <p className="text-xs text-amber-600">Credit sale without a customer cannot be tracked.</p>}
            </div>
            <Button className="w-full mt-4" loading={saving} onClick={handleSubmit}><ShoppingCart className="h-4 w-4" /> Record Sale</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const { business } = useAuth();
  const { toast } = useToast();
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', quantity: '1', unit_price: '0' }]);
  const [amountPaid, setAmountPaid] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const total = subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0);
  const due = total - (parseFloat(amountPaid) || 0);

  const addItem = () => setItems([...items, { product_id: '', quantity: '1', unit_price: '0' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const onProductChange = (idx: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    setItems(items.map((it, i) => i === idx ? { ...it, product_id: productId, unit_price: product ? String(product.cost_price) : '0' } : it));
  };

  const handleSubmit = async () => {
    const validItems = items.filter((it) => it.product_id && parseFloat(it.quantity) > 0);
    if (validItems.length === 0) { toast('Add at least one product', 'error'); return; }
    setSaving(true);
    try {
      const rpcItems = validItems.map((it) => ({
        product_id: it.product_id, quantity: parseFloat(it.quantity), unit_price: parseFloat(it.unit_price),
      }));
      const { data, error } = await supabase.rpc('create_purchase', {
        p_supplier_id: supplierId || null, p_items: rpcItems,
        p_amount_paid: parseFloat(amountPaid) || 0, p_discount_amount: parseFloat(discount) || 0,
        p_tax_amount: parseFloat(tax) || 0, p_notes: notes, p_idempotency_key: generateIdempotencyKey(),
      });
      if (error) throw error;
      toast('Purchase recorded successfully', 'success');
      navigate(`/app/transactions/${data.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to record purchase', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="New Purchase" description="Record a purchase from a supplier — inventory increases automatically" action={<Button variant="outline" onClick={() => navigate('/app/transactions')}>Cancel</Button>} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <Select label="Supplier (optional)" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Line Items</h3>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Add Item</Button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select label={idx === 0 ? "Product" : undefined} value={it.product_id} onChange={(e) => onProductChange(idx, e.target.value)}>
                      <option value="">Select product...</option>
                      {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2"><Input label={idx === 0 ? "Qty" : undefined} type="number" value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} /></div>
                  <div className="col-span-3"><Input label={idx === 0 ? "Unit Cost" : undefined} type="number" value={it.unit_price} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} /></div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 flex-1">{formatCurrency((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), business?.currency)}</span>
                    {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5"><Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Payment & Totals</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900">{formatCurrency(subtotal, business?.currency)}</span></div>
              <Input label="Discount" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              <Input label="Tax" type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
              <div className="flex justify-between text-sm border-t border-slate-100 pt-2"><span className="font-medium text-slate-700">Total</span><span className="font-bold text-slate-900">{formatCurrency(total, business?.currency)}</span></div>
              <Input label="Amount Paid" type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              <div className="flex justify-between text-sm"><span className="text-slate-500">Amount Due</span><span className={cn('font-bold', due > 0 ? 'text-amber-600' : 'text-emerald-600')}>{formatCurrency(due, business?.currency)}</span></div>
            </div>
            <Button className="w-full mt-4" loading={saving} onClick={handleSubmit}><PackageIcon className="h-4 w-4" /> Record Purchase</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function NewExpensePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('general');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const handleSubmit = async () => {
    if (!description.trim()) { toast('Description is required', 'error'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_expense', {
        p_description: description, p_amount: amt, p_category: category,
        p_supplier_id: supplierId || null, p_notes: notes, p_idempotency_key: generateIdempotencyKey(),
      });
      if (error) throw error;
      toast('Expense recorded', 'success');
      navigate(`/app/transactions/${data.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to record expense', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="New Expense" description="Record an operating expense" action={<Button variant="outline" onClick={() => navigate('/app/transactions')}>Cancel</Button>} />
      <Card className="p-6 max-w-lg">
        <div className="space-y-4">
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rent, electricity, salaries..." />
          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="general">General</option>
            <option value="rent">Rent</option>
            <option value="utilities">Utilities</option>
            <option value="salaries">Salaries</option>
            <option value="marketing">Marketing</option>
            <option value="supplies">Supplies</option>
            <option value="other">Other</option>
          </Select>
          <Select label="Supplier (optional)" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">No supplier</option>
            {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end gap-3 pt-6">
          <Button variant="outline" onClick={() => navigate('/app/transactions')}>Cancel</Button>
          <Button loading={saving} onClick={handleSubmit}>Record Expense</Button>
        </div>
      </Card>
    </div>
  );
}
