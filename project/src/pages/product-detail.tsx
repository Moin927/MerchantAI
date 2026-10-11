import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { fetchProduct, fetchInventoryMovements } from '@/lib/api';
import { Button, Input, Textarea, Card, Badge, Modal, Spinner } from '@/components/ui';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { ArrowLeft, Package, Edit, ArrowDownUp } from 'lucide-react';
import type { Product } from '@/lib/types';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
  });

  const { data: movements } = useQuery({
    queryKey: ['inventory-movements', id],
    queryFn: () => fetchInventoryMovements(id!),
    enabled: !!id,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [newQty, setNewQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!product) return <p className="text-slate-500">Product not found.</p>;

  const lowStock = product.quantity_on_hand <= product.low_stock_threshold;

  const handleEdit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('products').update({
        name: editForm.name ?? product.name,
        sku: editForm.sku ?? product.sku,
        description: editForm.description ?? product.description,
        selling_price: editForm.selling_price !== undefined ? Number(editForm.selling_price) : product.selling_price,
        cost_price: editForm.cost_price !== undefined ? Number(editForm.cost_price) : product.cost_price,
        low_stock_threshold: editForm.low_stock_threshold !== undefined ? Number(editForm.low_stock_threshold) : product.low_stock_threshold,
        updated_at: new Date().toISOString(),
      }).eq('id', product.id);
      if (error) throw error;
      toast('Product updated', 'success');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async () => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty < 0) {
      toast('Enter a valid quantity', 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('adjust_inventory', {
        p_product_id: product.id,
        p_new_quantity: qty,
        p_reason: adjustReason || 'Manual adjustment',
      });
      if (error) throw error;
      toast('Stock adjusted successfully', 'success');
      setAdjustOpen(false);
      setNewQty('');
      setAdjustReason('');
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Adjustment failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const movementColors: Record<string, string> = {
    sale: 'text-red-600', purchase: 'text-emerald-600', adjustment: 'text-blue-600',
    stock_in: 'text-emerald-600', stock_out: 'text-red-600', refund: 'text-amber-600',
  };

  return (
    <div>
      <Link to="/app/inventory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Inventory
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <Package className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{product.name}</h1>
                  <p className="text-sm text-slate-500">SKU: {product.sku || 'N/A'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditForm({ ...product }); setEditOpen(true); }}>
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
                  <ArrowDownUp className="h-3.5 w-3.5" /> Adjust Stock
                </Button>
              </div>
            </div>

            {product.description && <p className="mt-4 text-sm text-slate-600">{product.description}</p>}

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Cost Price</p>
                <p className="text-lg font-semibold text-slate-900">{formatCurrency(product.cost_price, business?.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Selling Price</p>
                <p className="text-lg font-semibold text-slate-900">{formatCurrency(product.selling_price, business?.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">In Stock</p>
                <p className={cn('text-lg font-semibold', lowStock ? 'text-amber-600' : 'text-slate-900')}>
                  {product.quantity_on_hand} {product.unit}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Low Stock At</p>
                <p className="text-lg font-semibold text-slate-900">{product.low_stock_threshold} {product.unit}</p>
              </div>
            </div>

            <div className="mt-4">
              {lowStock ? (
                <Badge variant="warning">Low Stock - needs restocking</Badge>
              ) : (
                <Badge variant="success">Well stocked</Badge>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Inventory History</h2>
            {movements && movements.length > 0 ? (
              <div className="space-y-2">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center gap-3">
                      <span className={cn('text-sm font-semibold', movementColors[m.movement_type] || 'text-slate-600')}>
                        {m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}
                      </span>
                      <div>
                        <p className="text-sm text-slate-700 capitalize">{m.movement_type.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-400">{m.notes}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{formatDateTime(m.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4">No inventory movements yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Inventory Value (cost)</span>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(product.cost_price * product.quantity_on_hand, business?.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Potential Revenue</span>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(product.selling_price * product.quantity_on_hand, business?.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Potential Profit</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {formatCurrency((product.selling_price - product.cost_price) * product.quantity_on_hand, business?.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Margin</span>
                <span className="text-sm font-semibold text-slate-900">
                  {product.selling_price > 0 ? Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100) : 0}%
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Product" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Name" value={editForm.name ?? ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <Input label="SKU" value={editForm.sku ?? ''} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
          <Input label="Cost Price" type="number" value={String(editForm.cost_price ?? '')} onChange={(e) => setEditForm({ ...editForm, cost_price: parseFloat(e.target.value) || 0 })} />
          <Input label="Selling Price" type="number" value={String(editForm.selling_price ?? '')} onChange={(e) => setEditForm({ ...editForm, selling_price: parseFloat(e.target.value) || 0 })} />
          <Input label="Low Stock Threshold" type="number" value={String(editForm.low_stock_threshold ?? '')} onChange={(e) => setEditForm({ ...editForm, low_stock_threshold: parseInt(e.target.value, 10) || 0 })} />
          <div className="col-span-2">
            <Textarea label="Description" value={editForm.description ?? ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleEdit}>Save Changes</Button>
        </div>
      </Modal>

      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust Stock" size="sm">
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-500">Current stock: <span className="font-semibold text-slate-900">{product.quantity_on_hand} {product.unit}</span></p>
          </div>
          <Input label="New Quantity" type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder={String(product.quantity_on_hand)} />
          <Input label="Reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Stock count correction, damage, etc." />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button loading={saving} onClick={handleAdjust}>Apply Adjustment</Button>
        </div>
      </Modal>
    </div>
  );
}
