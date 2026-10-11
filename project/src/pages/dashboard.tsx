import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callRpc } from '@/lib/api';
import { Card, PageHeader, Spinner, Badge } from '@/components/ui';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import type { Transaction } from '@/lib/types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  Users,
  Truck,
  Receipt,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Link } from 'react-router-dom';
import type { DashboardMetrics } from '@/lib/types';

export function DashboardPage() {
  const { business } = useAuth();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => callRpc<DashboardMetrics>('get_dashboard_metrics', {}),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['monthly-comparison'],
    queryFn: () => callRpc<Record<string, unknown>>('get_monthly_comparison', {}),
  });

  const { data: topProducts } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_products', { p_limit: 5 });
      if (error) throw error;
      return (data ?? []) as { product_name: string; total_quantity: number; total_revenue: number }[];
    },
  });

  const { data: recentTxns } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, customer:customers(name), supplier:suppliers(name)')
        .order('occurred_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as (Transaction & { customer?: { name: string } | null; supplier?: { name: string } | null })[];
    },
  });

  const { data: salesTrend } = useQuery({
    queryKey: ['sales-trend-7d'],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('occurred_at, total_amount')
        .eq('transaction_type', 'sale')
        .eq('status', 'completed')
        .gte('occurred_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('occurred_at', { ascending: true });
      // Group by date
      const grouped: Record<string, number> = {};
      (data ?? []).forEach((t) => {
        const date = new Date(t.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        grouped[date] = (grouped[date] || 0) + Number(t.total_amount);
      });
      return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
    },
  });

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const m = metrics;
  const monthly = monthlyData as {
    this_month?: { sales?: number; expenses?: number; purchases?: number };
    last_month?: { sales?: number; expenses?: number; purchases?: number };
    sales_change_pct?: number | null;
  } | undefined;

  const cards = [
    {
      label: "Today's Sales",
      value: m ? formatCurrency(m.total_sales, business?.currency) : '—',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Gross Profit',
      value: m ? formatCurrency(m.gross_profit, business?.currency) : '—',
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Expenses',
      value: m ? formatCurrency(m.total_expenses, business?.currency) : '—',
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Inventory Value',
      value: m ? formatCurrency(m.inventory_value, business?.currency) : '—',
      icon: Package,
      color: 'text-slate-700',
      bg: 'bg-slate-100',
    },
    {
      label: 'Receivables',
      value: m ? formatCurrency(m.total_receivables, business?.currency) : '—',
      icon: Users,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Payables',
      value: m ? formatCurrency(m.total_payables, business?.currency) : '—',
      icon: Truck,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Overview of ${business?.name ?? 'your business'}`}
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              {card.label === 'Gross Profit' && monthly?.sales_change_pct !== null && monthly?.sales_change_pct !== undefined && (
                <Badge variant={monthly.sales_change_pct >= 0 ? 'success' : 'error'}>
                  {monthly.sales_change_pct >= 0 ? '+' : ''}{monthly.sales_change_pct}%
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{card.value}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Sales Trend (7 days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={salesTrend ?? []}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                formatter={(value: unknown) => formatCurrency(Number(value) || 0, business?.currency)}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="amount" stroke="#0ea5e9" fill="url(#salesGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Monthly Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={[
                {
                  period: 'Last Month',
                  Sales: monthly?.last_month?.sales ?? 0,
                  Expenses: monthly?.last_month?.expenses ?? 0,
                },
                {
                  period: 'This Month',
                  Sales: monthly?.this_month?.sales ?? 0,
                  Expenses: monthly?.this_month?.expenses ?? 0,
                },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                formatter={(value: unknown) => formatCurrency(Number(value) || 0, business?.currency)}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar dataKey="Sales" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom row: top products + recent transactions */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Top Selling Products</h3>
          {topProducts && topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p: { product_name: string; total_quantity: number; total_revenue: number }, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{p.product_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(p.total_revenue, business?.currency)}</p>
                    <p className="text-xs text-slate-500">{formatNumber(p.total_quantity)} sold</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No sales recorded yet</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
            <Link to="/app/transactions" className="text-xs text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {recentTxns && recentTxns.length > 0 ? (
            <div className="space-y-2">
              {recentTxns.map((t) => (
                <Link
                  key={t.id}
                  to={`/app/transactions/${t.id}`}
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                      <Receipt className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{t.transaction_number}</p>
                      <p className="text-xs text-slate-500">
                        {t.transaction_type.replace('_', ' ')}
                        {t.customer?.name && ` - ${t.customer.name}`}
                        {t.supplier?.name && ` - ${t.supplier.name}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(t.total_amount, business?.currency)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No transactions yet</p>
          )}
        </Card>
      </div>

      {/* Low stock alert */}
      {m && m.low_stock_count > 0 && (
        <Card className="mt-4 p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{m.low_stock_count}</span> product(s) are running low on stock.{' '}
              <Link to="/app/inventory" className="font-medium underline">Review inventory</Link>
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
