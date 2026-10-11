import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { callRpc } from '@/lib/api';
import { Card, PageHeader, Spinner, Input, Badge } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { DashboardMetrics } from '@/lib/types';
import { TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, BarChart3 } from 'lucide-react';

export function ReportsPage() {
  const { business } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate, setEndDate] = useState(today);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['report-metrics', startDate, endDate],
    queryFn: () => callRpc<DashboardMetrics>('get_dashboard_metrics', { p_start_date: startDate, p_end_date: endDate }),
  });

  const { data: receivables } = useQuery({
    queryKey: ['report-receivables'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_outstanding_receivables');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: payables } = useQuery({
    queryKey: ['report-payables'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_outstanding_payables');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: lowStock } = useQuery({
    queryKey: ['report-low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_low_stock_products');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: topProducts } = useQuery({
    queryKey: ['report-top-products'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_products', { p_limit: 10 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const m = metrics;

  return (
    <div>
      <PageHeader title="Reports" description="Financial breakdown and business analytics" action={
        <div className="flex items-end gap-2">
          <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
          <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
        </div>
      } />

      {isLoading ? <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div> : m ? (
        <div className="space-y-6">
          {/* P&L Breakdown */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-slate-500" /> Profit & Loss ({formatDate(startDate)} - {formatDate(endDate)})</h2>
            <div className="space-y-3 max-w-2xl">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /><span className="text-sm text-slate-700">Revenue (Total Sales)</span></div><span className="font-semibold text-slate-900">{formatCurrency(m.total_sales, business?.currency)}</span></div>
              <div className="flex justify-between items-center pl-6"><span className="text-sm text-slate-500">Cost of Goods Sold (COGS)</span><span className="text-red-600">-{formatCurrency(m.cogs, business?.currency)}</span></div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100"><span className="text-sm font-medium text-slate-700 pl-6">Gross Profit</span><span className="font-semibold text-blue-600">{formatCurrency(m.gross_profit, business?.currency)}</span></div>
              <div className="flex justify-between items-center"><div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" /><span className="text-sm text-slate-700">Operating Expenses</span></div><span className="text-red-600">-{formatCurrency(m.total_expenses, business?.currency)}</span></div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200"><span className="text-base font-bold text-slate-900">Net Profit Estimate</span><span className={cn('text-lg font-bold', m.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(m.net_profit, business?.currency)}</span></div>
            </div>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Inventory Value', value: formatCurrency(m.inventory_value, business?.currency), icon: Package, color: 'text-slate-700' },
              { label: 'Receivables', value: formatCurrency(m.total_receivables, business?.currency), icon: DollarSign, color: 'text-amber-600' },
              { label: 'Payables', value: formatCurrency(m.total_payables, business?.currency), icon: DollarSign, color: 'text-purple-600' },
              { label: 'Low Stock Items', value: String(m.low_stock_count), icon: AlertTriangle, color: 'text-red-600' },
            ].map((s) => (
              <Card key={s.label} className="p-4"><div className="flex items-center justify-between"><s.icon className={cn('h-5 w-5', s.color)} /><span className="text-xs text-slate-500">{s.label}</span></div><p className="mt-2 text-lg font-bold text-slate-900">{s.value}</p></Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Receivables */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Customer Receivables</h3>
              {receivables && receivables.length > 0 ? <div className="space-y-2">{receivables.map((r: { customer_id: string; customer_name: string; balance: number }) => (<div key={r.customer_id} className="flex justify-between text-sm"><span className="text-slate-700">{r.customer_name}</span><span className="font-medium text-amber-600">{formatCurrency(r.balance, business?.currency)}</span></div>))}</div> : <p className="text-sm text-slate-400">No outstanding receivables.</p>}
            </Card>

            {/* Payables */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Supplier Payables</h3>
              {payables && payables.length > 0 ? <div className="space-y-2">{payables.map((p: { supplier_id: string; supplier_name: string; balance: number }) => (<div key={p.supplier_id} className="flex justify-between text-sm"><span className="text-slate-700">{p.supplier_name}</span><span className="font-medium text-purple-600">{formatCurrency(p.balance, business?.currency)}</span></div>))}</div> : <p className="text-sm text-slate-400">No outstanding payables.</p>}
            </Card>

            {/* Low stock */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Low Stock Products</h3>
              {lowStock && lowStock.length > 0 ? <div className="space-y-2">{lowStock.map((p: { id: string; name: string; quantity_on_hand: number; low_stock_threshold: number }) => (<div key={p.id} className="flex justify-between text-sm"><span className="text-slate-700">{p.name}</span><Badge variant="warning">{p.quantity_on_hand} / {p.low_stock_threshold}</Badge></div>))}</div> : <p className="text-sm text-slate-400">All products well stocked.</p>}
            </Card>

            {/* Top products */}
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Top Selling Products</h3>
              {topProducts && topProducts.length > 0 ? <div className="space-y-2">{topProducts.map((p: { product_name: string; total_quantity: number; total_revenue: number }, i: number) => (<div key={i} className="flex justify-between text-sm"><div className="flex items-center gap-2"><span className="text-slate-400 text-xs">{i + 1}</span><span className="text-slate-700">{p.product_name}</span></div><div className="text-right"><span className="font-medium text-slate-900">{formatCurrency(p.total_revenue, business?.currency)}</span><span className="text-xs text-slate-400 ml-2">{p.total_quantity} sold</span></div></div>))}</div> : <p className="text-sm text-slate-400">No sales data yet.</p>}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
