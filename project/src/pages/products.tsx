import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { fetchProducts } from '@/lib/api';
import { Button, Input, Select, Card, Badge, Modal, PageHeader, EmptyState, Spinner } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { Plus, Search, Package, AlertTriangle } from 'lucide-react';

interface ProductForm {
  name: string;
  sku: string;
  description: string;
  unit: string;
  cost_price: string;
  selling_price: string;
  quantity_on_hand: string;
  low_stock_threshold: string;
}

const emptyForm: ProductForm = {
  name: '', sku: '', description: '', unit: 'piece',
  cost_price: '0', selling_price: '0', quantity_on_hand: '0', low_stock_threshold: '5',
};

export function ProductsPage({ showLowStockOnly = false }: { showLowStockOnly?: boolean }) {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: () => fetchProducts(search, page, 20),
  });

  const products = data?.data ?? [];
  const filtered = showLowStockOnly
    ? products.filter((p) => p.quantity_on_hand <= p.low_stock_threshold)
    : products;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('Product name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('products').insert({
        name: form.name,
        sku: form.sku,
        description: form.description,
        unit: form.unit,
        cost_price: parseFloat(form.cost_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        quantity_on_hand: parseFloat(form.quantity_on_hand) || 0,
        low_stock_threshold: parseFloat(form.low_stock_threshold) || 5,
        is_active: true,
      });
      if (error) throw error;
      toast('Product created successfully', 'success');
      setModalOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create product', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={showLowStockOnly ? 'Low Stock Alert' : 'Products'}
        description={showLowStockOnly ? 'Products running low on stock' : 'Manage your product catalog'}
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No products found"
            description="Add your first product to start tracking inventory and sales."
            action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Product</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cost</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Price</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Stock</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const lowStock = p.quantity_on_hand <= p.low_stock_threshold;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/app/products/${p.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.cost_price, business?.currency)}</td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">{formatCurrency(p.selling_price, business?.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-medium', lowStock ? 'text-amber-600' : 'text-slate-700')}>
                        {p.quantity_on_hand} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lowStock ? (
                        <Badge variant="warning"><AlertTriangle className="h-3 w-3 mr-1 inline" /> Low</Badge>
                      ) : (
                        <Badge variant="success">In Stock</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && data.total > 20 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">Page {page} of {Math.ceil(data.total / 20)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Product" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="iPhone 15" />
          </div>
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="IP15-001" />
          <Select label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="piece">piece</option>
            <option value="box">box</option>
            <option value="kg">kg</option>
            <option value="meter">meter</option>
            <option value="set">set</option>
          </Select>
          <Input label="Cost Price" type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          <Input label="Selling Price" type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <Input label="Initial Stock" type="number" value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} />
          <Input label="Low Stock Threshold" type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
          <div className="col-span-2">
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleSave}>Save Product</Button>
        </div>
      </Modal>
    </div>
  );
}

export function InventoryPage() {
  return <ProductsPage showLowStockOnly />;
}
