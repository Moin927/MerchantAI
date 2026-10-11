import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchTransaction } from '@/lib/api';
import { Card, Badge, Spinner } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Receipt } from 'lucide-react';

const typeBadges: Record<string, 'success' | 'info' | 'error' | 'warning' | 'purple' | 'default'> = {
  sale: 'success', purchase: 'info', expense: 'error',
  customer_payment: 'warning', supplier_payment: 'purple', refund: 'default',
};

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();

  const { data: txn, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => fetchTransaction(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!txn) return <p className="text-slate-500">Transaction not found.</p>;

  return (
    <div>
      <Link to="/app/transactions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Transactions
      </Link>

      <Card className="p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <Receipt className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{txn.transaction_number}</h1>
              <p className="text-sm text-slate-500">{formatDateTime(txn.occurred_at)}</p>
            </div>
          </div>
          <Badge variant={typeBadges[txn.transaction_type] || 'default'}>{txn.transaction_type.replace('_', ' ')}</Badge>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {txn.customer && <div><p className="text-xs text-slate-500">Customer</p><p className="text-sm font-medium text-slate-900">{txn.customer.name}</p></div>}
          {txn.supplier && <div><p className="text-xs text-slate-500">Supplier</p><p className="text-sm font-medium text-slate-900">{txn.supplier.name}</p></div>}
          <div><p className="text-xs text-slate-500">Status</p><Badge variant={txn.status === 'completed' ? 'success' : 'error'}>{txn.status}</Badge></div>
          <div><p className="text-xs text-slate-500">Total</p><p className="text-sm font-semibold text-slate-900">{formatCurrency(txn.total_amount, business?.currency)}</p></div>
        </div>

        {txn.notes && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{txn.notes}</div>}
      </Card>

      {txn.items && txn.items.length > 0 && (
        <Card className="overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Qty</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Unit Price</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txn.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3 text-slate-700">{it.description}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{it.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(it.unit_price, business?.currency)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(it.line_total, business?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Summary</h3>
        <div className="space-y-2 max-w-xs ml-auto">
          <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="text-slate-900">{formatCurrency(txn.subtotal, business?.currency)}</span></div>
          {txn.discount_amount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span className="text-red-600">-{formatCurrency(txn.discount_amount, business?.currency)}</span></div>}
          {txn.tax_amount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Tax</span><span className="text-slate-900">+{formatCurrency(txn.tax_amount, business?.currency)}</span></div>}
          <div className="flex justify-between text-sm border-t border-slate-100 pt-2 font-medium"><span className="text-slate-700">Total</span><span className="text-slate-900">{formatCurrency(txn.total_amount, business?.currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Paid</span><span className="text-emerald-600">{formatCurrency(txn.amount_paid, business?.currency)}</span></div>
          {txn.amount_due > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Due</span><span className="text-amber-600 font-bold">{formatCurrency(txn.amount_due, business?.currency)}</span></div>}
        </div>
      </Card>
    </div>
  );
}
