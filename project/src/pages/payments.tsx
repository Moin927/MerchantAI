import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { fetchPayments } from '@/lib/api';
import { Card, Badge, PageHeader, EmptyState, Spinner, Button } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { CreditCard } from 'lucide-react';

const methodBadges: Record<string, 'default' | 'info' | 'warning' | 'purple' | 'success'> = {
  cash: 'default', bank: 'info', card: 'purple', solana: 'warning', other: 'default',
};

export function PaymentsPage() {
  const { business } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page],
    queryFn: () => fetchPayments(page, 20),
  });

  const payments = data?.data ?? [];

  return (
    <div>
      <PageHeader title="Payments" description="All recorded payments across your business" />
      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> :
        payments.length === 0 ? <Card><EmptyState icon={CreditCard} title="No payments yet" description="Payments are created automatically when you record sales with payments or customer/supplier payments." /></Card> :
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="text-left px-4 py-3 font-medium text-slate-600">Date</th><th className="text-left px-4 py-3 font-medium text-slate-600">Method</th><th className="text-left px-4 py-3 font-medium text-slate-600">Party</th><th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th><th className="text-right px-4 py-3 font-medium text-slate-600">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(p.paid_at)}</td>
                  <td className="px-4 py-3"><Badge variant={methodBadges[p.payment_method] || 'default'}>{p.payment_method}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">{p.customer?.name || p.supplier?.name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(p.amount, business?.currency)}</td>
                  <td className="px-4 py-3 text-right"><Badge variant={p.status === 'completed' ? 'success' : 'warning'}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.total > 20 && <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">Page {page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
        </Card>
      }
    </div>
  );
}
