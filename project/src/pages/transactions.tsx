import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchTransactions } from '@/lib/api';
import { Button, Card, Badge, PageHeader, EmptyState, Spinner } from '@/components/ui';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { Receipt, Search, Plus, ShoppingCart } from 'lucide-react';

const typeFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sale', label: 'Sales' },
  { value: 'purchase', label: 'Purchases' },
  { value: 'expense', label: 'Expenses' },
  { value: 'customer_payment', label: 'Customer Payments' },
  { value: 'supplier_payment', label: 'Supplier Payments' },
];

const typeBadges: Record<string, 'success' | 'info' | 'error' | 'warning' | 'purple' | 'default'> = {
  sale: 'success', purchase: 'info', expense: 'error',
  customer_payment: 'warning', supplier_payment: 'purple', refund: 'default',
};

export function TransactionsPage() {
  const { business } = useAuth();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', type, search, page],
    queryFn: () => fetchTransactions(type, search, page, 20),
  });

  const transactions = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="All your sales, purchases, expenses, and payments"
        action={
          <div className="flex gap-2">
            <Link to="/app/transactions/new-sale"><Button size="sm"><ShoppingCart className="h-4 w-4" /> New Sale</Button></Link>
            <Link to="/app/transactions/new-purchase"><Button variant="outline" size="sm">New Purchase</Button></Link>
            <Link to="/app/transactions/new-expense"><Button variant="outline" size="sm">New Expense</Button></Link>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setType(f.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                type === f.value ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : transactions.length === 0 ? (
        <Card><EmptyState icon={Receipt} title="No transactions yet" description="Record your first sale, purchase, or expense to get started." action={<Link to="/app/transactions/new-sale"><Button size="sm"><Plus className="h-4 w-4" /> New Sale</Button></Link>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Number</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Party</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/app/transactions/${t.id}`} className="font-medium text-slate-900 hover:text-blue-600">{t.transaction_number}</Link>
                  </td>
                  <td className="px-4 py-3"><Badge variant={typeBadges[t.transaction_type] || 'default'}>{t.transaction_type.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">{t.customer?.name || t.supplier?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(t.occurred_at)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(t.total_amount, business?.currency)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.amount_due > 0 ? <span className="text-amber-600 font-medium">{formatCurrency(t.amount_due, business?.currency)}</span> : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
