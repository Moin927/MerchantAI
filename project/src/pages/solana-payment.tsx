import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { fetchInvoice } from '@/lib/api';
import { Button, Card, Badge, Spinner } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Wallet, Copy, ExternalLink, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import type { SolanaPaymentRecord } from '@/lib/types';

const DEMO_RECIPIENT_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA2ddXKS2FPkRJm';

export function SolanaPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [simulating, setSimulating] = useState(false);
  const [signature, setSignature] = useState('');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoice(id!),
    enabled: !!id,
  });

  const { data: existingRecords } = useQuery({
    queryKey: ['solana-records-pay', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('solana_payment_records').select('*').eq('invoice_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SolanaPaymentRecord[];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!invoice) return <p className="text-slate-500">Invoice not found.</p>;

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      // Create a simulated Solana payment record
      const fakeSignature = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + 'xx';
      const { data: solanaRecord, error } = await supabase.from('solana_payment_records').insert({
        business_id: business?.id,
        invoice_id: invoice.id,
        network: 'devnet',
        token_mint: 'native-sol',
        recipient_wallet: DEMO_RECIPIENT_WALLET,
        expected_amount: invoice.amount_due,
        transaction_signature: fakeSignature,
        status: 'simulated',
      }).select().single();
      if (error) throw error;

      // Also create a payment record
      const { data: payment } = await supabase.from('payments').insert({
        business_id: business?.id,
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        payment_method: 'solana',
        amount: invoice.amount_due,
        currency: 'SOL',
        status: 'completed',
        external_reference: fakeSignature,
        paid_at: new Date().toISOString(),
      }).select().single();

      // Update solana record with payment link
      if (payment) {
        await supabase.from('solana_payment_records').update({ payment_id: payment.id }).eq('id', solanaRecord.id);
      }

      // Update invoice
      await supabase.from('invoices').update({
        amount_paid: invoice.amount_paid + invoice.amount_due,
        amount_due: 0,
        status: 'paid',
        updated_at: new Date().toISOString(),
      }).eq('id', invoice.id);

      setSignature(fakeSignature);
      toast('Simulated payment completed. This is NOT a real on-chain transaction.', 'success');
      queryClient.invalidateQueries();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Simulation failed', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'info');
  };

  return (
    <div>
      <Link to={`/app/invoices/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Invoice
      </Link>

      <div className="max-w-2xl mx-auto">
        <Card className="p-6 mb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Wallet className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Solana Payment</h1>
              <p className="text-sm text-slate-500">Invoice {invoice.invoice_number}</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Amount Due</span><span className="font-bold text-slate-900">{formatCurrency(invoice.amount_due, business?.currency)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Customer</span><span className="text-slate-900">{invoice.customer?.name ?? '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Due Date</span><span className="text-slate-900">{formatDate(invoice.due_date)}</span></div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Network</span>
              <Badge variant="info">Solana Devnet</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Token</span>
              <span className="text-sm font-medium text-slate-900">SOL (native)</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-500 flex-shrink-0">Recipient Wallet</span>
              <div className="flex items-center gap-1 max-w-[200px]">
                <span className="text-xs font-mono text-slate-700 truncate">{DEMO_RECIPIENT_WALLET.slice(0, 8)}...{DEMO_RECIPIENT_WALLET.slice(-6)}</span>
                <button onClick={() => copyToClipboard(DEMO_RECIPIENT_WALLET)} className="text-slate-400 hover:text-slate-600"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        </Card>

        {/* Demo mode warning */}
        <Card className="p-4 mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Demo / Simulated Payment Mode</p>
              <p className="text-xs text-amber-700 mt-1">
                This is a simulated payment flow. No real Solana transaction will be sent.
                The payment will be marked as "simulated" in the database, not as a verified on-chain transaction.
                In production, this would verify a real Devnet transaction signature using a Solana RPC node.
              </p>
            </div>
          </div>
        </Card>

        {signature ? (
          <Card className="p-6 border-emerald-200">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-900">Simulated Payment Completed</p>
                <p className="text-xs text-slate-500">This is a simulated transaction, not a real on-chain payment.</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Simulated Signature</span><span className="font-mono text-xs text-slate-700">{signature.slice(0, 20)}...</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><Badge variant="warning">Simulated</Badge></div>
            </div>
            <a href={`https://solscan.io/tx/${signature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
              View on Solscan (will not exist - simulated) <ExternalLink className="h-3 w-3" />
            </a>
          </Card>
        ) : (
          <Button className="w-full" size="lg" loading={simulating} onClick={handleSimulate}>
            <Zap className="h-5 w-5" /> Simulate Solana Payment
          </Button>
        )}

        {existingRecords && existingRecords.length > 0 && (
          <Card className="p-4 mt-4">
            <h3 className="font-semibold text-slate-900 mb-3">Payment History (Solana)</h3>
            <div className="space-y-2">
              {existingRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{formatCurrency(r.expected_amount, 'SOL')}</p>
                    <p className="text-xs text-slate-400 font-mono">{r.transaction_signature?.slice(0, 20) ?? 'No signature'}...</p>
                  </div>
                  <Badge variant={r.status === 'verified' ? 'success' : r.status === 'simulated' ? 'warning' : 'info'}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
