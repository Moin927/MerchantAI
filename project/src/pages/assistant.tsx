import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { Button, Card, Spinner, PageHeader } from '@/components/ui';
import { AiModeBadge } from '@/components/mode-badges';
import { formatCurrency, cn, generateIdempotencyKey } from '@/lib/utils';
import { Bot, Send, Check, X, Sparkles, AlertTriangle, TrendingUp, Package, Users, Truck, Receipt } from 'lucide-react';
import type { ParsedIntent, Product, Customer, Supplier } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposal?: ParsedIntent & { resolvedProducts?: { name: string; product: Product }[]; resolvedCustomer?: Customer; resolvedSupplier?: Supplier };
  proposalId?: string;
}

const sampleCommands = [
  "Sell 2 iPhones to Ahmed for 500000, paid 200000",
  "Aaj Ahmed ko 2 iPhones 500000 rupees mein sell kiye, usne 200000 pay kiye",
  "How much did I sell today?",
  "Which products are low in stock?",
  "What is my gross profit this month?",
  "Who owes me money?",
  "Record an expense of 5000 for electricity",
  "How much do I owe my suppliers?",
];

// Demo intent parser — deterministic, rule-based
export function parseIntent(text: string): ParsedIntent {
  const lower = text.toLowerCase().trim();
  const warnings: string[] = [];
  const missing: string[] = [];

  // Detect intent type
  let intent = 'unknown';
  let transactionType: ParsedIntent['transaction_type'] = null;

  const saleKeywords = ['sell', 'sold', 'sale', 'sell kiye', 'beche', 'sell kiya', 'customer ko'];
  const purchaseKeywords = ['purchase', 'bought', 'buy', 'khareede', 'stock', 'order kiya'];
  const expenseKeywords = ['expense', 'bill', 'rent', 'electricity', 'kharcha', 'bill pay'];
  const paymentInKeywords = ['customer pay', 'received payment', 'customer ne pay', 'paise milay'];
  const paymentOutKeywords = ['supplier pay', 'paid supplier', 'supplier ko pay', 'pay kiya supplier ko'];

  // Question detection first
  const questionKeywords = ['how much', 'what is', 'which', 'who owes', 'show me', 'list', 'kaisa', 'kitna', 'kitne', 'kya', 'kaun', 'compare', 'monthly'];
  const isQuestion = lower.includes('?') || questionKeywords.some((k) => lower.includes(k));

  if (isQuestion) {
    if ((lower.includes('sale') || lower.includes('sell')) && (lower.includes('today') || lower.includes('how much'))) {
      intent = 'ask_sales_summary';
    } else if (lower.includes('profit') || lower.includes('gross')) {
      intent = 'ask_gross_profit';
    } else if (lower.includes('low stock') || lower.includes('low in stock') || lower.includes('low inventory') || lower.includes('reorder')) {
      intent = 'ask_low_stock';
    } else if ((lower.includes('owe me') || lower.includes('owes me') || lower.includes('receivable') || lower.includes('customer balance')) && !lower.includes('supplier')) {
      intent = 'ask_receivables';
    } else if ((lower.includes('owe') && lower.includes('supplier')) || lower.includes('payable')) {
      intent = 'ask_payables';
    } else if (lower.includes('top') || lower.includes('best sell') || lower.includes('most sell')) {
      intent = 'ask_top_products';
    } else if (lower.includes('compare') || lower.includes('monthly')) {
      intent = 'ask_monthly_comparison';
    } else if (lower.includes('expense')) {
      intent = 'ask_expenses';
    } else {
      intent = 'general_question';
    }
  } else if (saleKeywords.some((k) => lower.includes(k))) {
    intent = 'record_sale'; transactionType = 'sale';
  } else if (purchaseKeywords.some((k) => lower.includes(k))) {
    intent = 'record_purchase'; transactionType = 'purchase';
  } else if (expenseKeywords.some((k) => lower.includes(k))) {
    intent = 'record_expense'; transactionType = 'expense';
  } else if (paymentInKeywords.some((k) => lower.includes(k))) {
    intent = 'record_customer_payment'; transactionType = 'customer_payment';
  } else if (paymentOutKeywords.some((k) => lower.includes(k))) {
    intent = 'record_supplier_payment'; transactionType = 'supplier_payment';
  }

  // Extract quantities and product names
  const products: { name: string; quantity: number; unit_price?: number }[] = [];
  const qtyMatch = text.match(/(\d+)\s*(?:x|pieces?|pcs?|units?|items?)?\s+/i);
  const numMatches = text.matchAll(/(\d+)\s*(?:x|pieces?|pcs?|units?|items?)?/gi);
  const allNums: number[] = [];
  for (const m of numMatches) allNums.push(parseInt(m[1]));

  // Extract monetary amounts
  const amounts = text.matchAll(/(\d[\d,]*)\s*(?:rupees?|rs\.?|pkr|amount)?/gi);
  const allAmounts: number[] = [];
  for (const m of amounts) {
    const val = parseInt(m[1].replace(/,/g, ''));
    if (val >= 100) allAmounts.push(val);
  }

  // Try to extract product name — look for known product patterns
  const productPattern = text.match(/(?:sell|sold|beche|purchase|buy|khareede)\s+(?:\d+\s*x?\s*)?([A-Za-z\s]+?)(?:\s+to\s+|\s+for\s+|\s+se\s+|\s+,)/i);
  let productName = '';
  if (productPattern) productName = productPattern[1].trim();
  else if (qtyMatch) {
    const afterQty = text.substring(qtyMatch.index! + qtyMatch[0].length).trim();
    const stopWords = ['to', 'for', 'se', 'from', 'at', 'in', 'ka', 'ki', 'ke'];
    const words = afterQty.split(/\s+/);
    const prodWords: string[] = [];
    for (const w of words) {
      if (stopWords.includes(w.toLowerCase())) break;
      prodWords.push(w);
      if (prodWords.length >= 3) break;
    }
    productName = prodWords.join(' ').trim();
  }

  const quantity = allNums.length > 0 ? (allNums.find((n) => n <= 1000) ?? allNums[0]) : 1;
  if (productName) products.push({ name: productName, quantity });

  // Extract customer/supplier name
  let customerName: string | undefined;
  let supplierName: string | undefined;
  const toMatch = text.match(/(?:to|ko)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (toMatch) customerName = toMatch[1].trim();
  const fromMatch = text.match(/(?:from|se)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (fromMatch) supplierName = fromMatch[1].trim();

  // Extract payment amounts
  const paidMatch = text.match(/(?:paid|pay|ditye|diye|paid now)\s*:?\s*(\d[\d,]*)/i) || text.match(/(\d[\d,]*)\s*(?:pay|diye|ditye|paid)/i);
  const amountPaid = paidMatch ? parseInt(paidMatch[1].replace(/,/g, '')) : undefined;

  // Total amount
  const totalMatch = text.match(/(?:for|ke|rs\.?|rupees?)\s*(\d[\d,]*)/i);
  const totalAmount = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : (allAmounts.length > 0 ? allAmounts[0] : undefined);

  // Build summary
  let summary = '';
  if (transactionType === 'sale') {
    summary = `Record a sale of ${quantity} ${productName || 'item(s)'}${customerName ? ` to ${customerName}` : ''}${totalAmount ? ` for ${totalAmount}` : ''}${amountPaid ? ` with ${amountPaid} paid now` : ''}.`;
    if (!productName) missing.push('product name');
    if (!totalAmount) missing.push('selling price');
    if (!customerName) warnings.push('No customer specified — this will be a walk-in sale.');
  } else if (transactionType === 'purchase') {
    summary = `Record a purchase of ${quantity} ${productName || 'item(s)'}${supplierName ? ` from ${supplierName}` : ''}${totalAmount ? ` for ${totalAmount}` : ''}.`;
    if (!productName) missing.push('product name');
  } else if (transactionType === 'expense') {
    summary = `Record an expense of ${totalAmount || 'an amount'} for ${productName || 'the described item'}.`;
    if (!totalAmount) missing.push('expense amount');
  } else if (isQuestion) {
    summary = `I'll look up your business data to answer that question.`;
  } else {
    summary = `I couldn't understand the intent. Try: "Sell 2 iPhones to Ahmed for 500000" or "How much did I sell today?"`;
  }

  return {
    intent, transaction_type: transactionType, products,
    customer_name: customerName, supplier_name: supplierName,
    amount_paid: amountPaid, total_amount: totalAmount,
    missing_fields: missing, warnings, summary,
  };
}

async function resolveEntities(parsed: ParsedIntent, businessId: string): Promise<ChatMessage['proposal']> {
  const resolvedProducts: { name: string; product: Product }[] = [];
  for (const p of parsed.products) {
    let query = supabase
      .from('products')
      .select('*')
      .ilike('name', `%${p.name}%`)
      .eq('is_active', true);
    if (businessId) {
      query = query.eq('business_id', businessId);
    }
    const { data } = await query.limit(5);
    if (data && data.length > 0) {
      resolvedProducts.push({ name: p.name, product: data[0] as Product });
    }
  }

  let resolvedCustomer: Customer | undefined;
  if (parsed.customer_name) {
    let query = supabase.from('customers').select('*').ilike('name', `%${parsed.customer_name}%`);
    if (businessId) {
      query = query.eq('business_id', businessId);
    }
    const { data } = await query.limit(1).maybeSingle();
    if (data) resolvedCustomer = data as Customer;
  }

  let resolvedSupplier: Supplier | undefined;
  if (parsed.supplier_name) {
    let query = supabase.from('suppliers').select('*').ilike('name', `%${parsed.supplier_name}%`);
    if (businessId) {
      query = query.eq('business_id', businessId);
    }
    const { data } = await query.limit(1).maybeSingle();
    if (data) resolvedSupplier = data as Supplier;
  }

  return { ...parsed, resolvedProducts, resolvedCustomer, resolvedSupplier };
}

async function answerQuestion(intent: string, currency: string): Promise<string> {
  if (intent === 'ask_sales_summary') {
    const { data } = await supabase.rpc('get_dashboard_metrics', { p_start_date: new Date().toISOString().slice(0, 10), p_end_date: new Date().toISOString().slice(0, 10) });
    const m = data as { total_sales?: number; sales_count?: number };
    return `Today's sales total: ${formatCurrency(m.total_sales ?? 0, currency)} from ${m.sales_count ?? 0} transaction(s). This is based on your actual database records.`;
  }
  if (intent === 'ask_gross_profit') {
    const firstOfMonth = new Date(); firstOfMonth.setDate(1);
    const { data } = await supabase.rpc('get_dashboard_metrics', { p_start_date: firstOfMonth.toISOString().slice(0, 10), p_end_date: new Date().toISOString().slice(0, 10) });
    const m = data as { gross_profit?: number; total_sales?: number; total_expenses?: number; net_profit?: number };
    return `This month: Revenue ${formatCurrency(m.total_sales ?? 0, currency)}, Gross Profit ${formatCurrency(m.gross_profit ?? 0, currency)}, Expenses ${formatCurrency(m.total_expenses ?? 0, currency)}, Net Profit Estimate ${formatCurrency(m.net_profit ?? 0, currency)}. All figures are from your actual transaction records.`;
  }
  if (intent === 'ask_low_stock') {
    const { data } = await supabase.rpc('get_low_stock_products');
    if (!data || data.length === 0) return 'All products are well stocked. No items need restocking.';
    const items = data.map((p: { name: string; quantity_on_hand: number; low_stock_threshold: number }) => `${p.name} (${p.quantity_on_hand} left, threshold ${p.low_stock_threshold})`).join(', ');
    return `Low stock products: ${items}. Consider restocking these items.`;
  }
  if (intent === 'ask_receivables') {
    const { data } = await supabase.rpc('get_outstanding_receivables');
    if (!data || data.length === 0) return 'No customers owe you money. All receivables are settled.';
    const items = data.map((r: { customer_name: string; balance: number }) => `${r.customer_name}: ${formatCurrency(r.balance, currency)}`).join(', ');
    return `Customers with outstanding balances: ${items}. Total receivables: ${formatCurrency(data.reduce((s: number, r: { balance: number }) => s + r.balance, 0), currency)}.`;
  }
  if (intent === 'ask_payables') {
    const { data } = await supabase.rpc('get_outstanding_payables');
    if (!data || data.length === 0) return 'You do not owe any suppliers. All payables are settled.';
    const items = data.map((p: { supplier_name: string; balance: number }) => `${p.supplier_name}: ${formatCurrency(p.balance, currency)}`).join(', ');
    return `Suppliers you owe: ${items}. Total payables: ${formatCurrency(data.reduce((s: number, p: { balance: number }) => s + p.balance, 0), currency)}.`;
  }
  if (intent === 'ask_top_products') {
    const { data } = await supabase.rpc('get_top_products', { p_limit: 5 });
    if (!data || data.length === 0) return 'No sales data available yet to determine top products.';
    const items = data.map((p: { product_name: string; total_revenue: number; total_quantity: number }, i: number) => `${i + 1}. ${p.product_name} - ${formatCurrency(p.total_revenue, currency)} (${p.total_quantity} sold)`).join('\n');
    return `Top selling products by revenue:\n${items}`;
  }
  if (intent === 'ask_monthly_comparison') {
    const { data } = await supabase.rpc('get_monthly_comparison');
    const d = data as { this_month?: { sales?: number; expenses?: number }; last_month?: { sales?: number; expenses?: number }; sales_change_pct?: number | null };
    return `This month: Sales ${formatCurrency(d.this_month?.sales ?? 0, currency)}, Expenses ${formatCurrency(d.this_month?.expenses ?? 0, currency)}. Last month: Sales ${formatCurrency(d.last_month?.sales ?? 0, currency)}, Expenses ${formatCurrency(d.last_month?.expenses ?? 0, currency)}. Sales change: ${d.sales_change_pct !== null && d.sales_change_pct !== undefined ? (d.sales_change_pct >= 0 ? '+' : '') + d.sales_change_pct + '%' : 'N/A'}.`;
  }
  if (intent === 'ask_expenses') {
    const firstOfMonth = new Date(); firstOfMonth.setDate(1);
    const { data } = await supabase.rpc('get_dashboard_metrics', { p_start_date: firstOfMonth.toISOString().slice(0, 10), p_end_date: new Date().toISOString().slice(0, 10) });
    const m = data as { total_expenses?: number };
    return `Total expenses this month: ${formatCurrency(m.total_expenses ?? 0, currency)}. Based on your recorded expense transactions.`;
  }
  return 'I can help you with: recording sales, purchases, expenses, payments, checking sales totals, gross profit, low stock, customer balances, supplier balances, top products, and monthly comparisons. Try one of the sample commands below.';
}

export function AssistantPage() {
  const { business } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I\'m your AI business assistant. I can help you record transactions and answer questions about your business. Try: "Sell 2 iPhones to Ahmed for 500000, paid 200000" or ask "How much did I sell today?"' },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || processing) return;
    setInput('');
    setProcessing(true);
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);

    try {
      const parsed = parseIntent(msg);

      // If it's a question, answer directly from the database
      if (parsed.intent.startsWith('ask_') || parsed.intent === 'general_question') {
        const answer = await answerQuestion(parsed.intent, business?.currency ?? 'PKR');
        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      } else if (parsed.transaction_type) {
        // Resolve entities against real database
        const proposal = await resolveEntities(parsed, business?.id ?? '');

        // Store proposal in database
        const { data: propData } = await supabase.from('ai_proposals').insert({
          business_id: business?.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          original_text: msg,
          parsed_intent: parsed,
          status: 'pending',
        }).select().single();

        // Check for issues
        const issues: string[] = [...parsed.warnings];
        if (parsed.missing_fields.length > 0) issues.push(`Missing: ${parsed.missing_fields.join(', ')}`);
        if (proposal?.resolvedProducts && proposal.resolvedProducts.length === 0 && parsed.products.length > 0) {
          issues.push(`Product "${parsed.products[0].name}" not found in your inventory. Please add it first or check the name.`);
        }

        const content = issues.length > 0
          ? `${parsed.summary}\n\n⚠️ Issues:\n${issues.map((i) => `• ${i}`).join('\n')}`
          : `${parsed.summary}\n\nPlease review and confirm to proceed.`;

        setMessages((prev) => [...prev, { role: 'assistant', content, proposal, proposalId: propData?.id }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: parsed.summary }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async (msg: ChatMessage) => {
    if (!msg.proposal || !msg.proposalId) return;
    setExecuting(true);
    try {
      const p = msg.proposal;
      let result: { id?: string } | null = null;

      if (p.transaction_type === 'sale' && p.resolvedProducts && p.resolvedProducts.length > 0) {
        const items = p.resolvedProducts.map((rp) => ({
          product_id: rp.product.id,
          quantity: p.products[0].quantity,
          unit_price: p.total_amount ? p.total_amount / p.products[0].quantity : rp.product.selling_price,
        }));
        const { data, error } = await supabase.rpc('create_sale', {
          p_customer_id: p.resolvedCustomer?.id ?? null,
          p_items: items,
          p_amount_paid: p.amount_paid ?? 0,
          p_notes: `Created via AI Assistant: ${msg.content}`,
          p_idempotency_key: generateIdempotencyKey(),
        });
        if (error) throw error;
        result = data;
      } else if (p.transaction_type === 'purchase' && p.resolvedProducts && p.resolvedProducts.length > 0) {
        const items = p.resolvedProducts.map((rp) => ({
          product_id: rp.product.id,
          quantity: p.products[0].quantity,
          unit_price: p.total_amount ? p.total_amount / p.products[0].quantity : rp.product.cost_price,
        }));
        const { data, error } = await supabase.rpc('create_purchase', {
          p_supplier_id: p.resolvedSupplier?.id ?? null,
          p_items: items,
          p_amount_paid: p.amount_paid ?? 0,
          p_notes: `Created via AI Assistant: ${msg.content}`,
          p_idempotency_key: generateIdempotencyKey(),
        });
        if (error) throw error;
        result = data;
      } else if (p.transaction_type === 'expense' && p.total_amount) {
        const { data, error } = await supabase.rpc('create_expense', {
          p_description: p.products[0]?.name ?? 'Expense via AI',
          p_amount: p.total_amount,
          p_notes: `Created via AI Assistant: ${msg.content}`,
          p_idempotency_key: generateIdempotencyKey(),
        });
        if (error) throw error;
        result = data;
      }

      // Mark proposal as executed
      await supabase.from('ai_proposals').update({
        status: 'executed', confirmed_at: new Date().toISOString(),
        executed_transaction_id: result?.id,
      }).eq('id', msg.proposalId);

      setMessages((prev) => prev.map((m) => m === msg ? { ...m, content: `${m.content}\n\n✅ Transaction recorded successfully! Transaction ID: ${result?.id ?? 'created'}` } : m));
      toast('Transaction recorded via AI Assistant', 'success');
      queryClient.invalidateQueries();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to execute transaction', 'error');
      setMessages((prev) => prev.map((m) => m === msg ? { ...m, content: `${m.content}\n\n❌ Failed: ${err instanceof Error ? err.message : 'Unknown error'}` } : m));
    } finally {
      setExecuting(false);
    }
  };

  const handleReject = async (msg: ChatMessage) => {
    if (msg.proposalId) {
      await supabase.from('ai_proposals').update({ status: 'rejected' }).eq('id', msg.proposalId);
    }
    setMessages((prev) => prev.map((m) => m === msg ? { ...m, content: `${m.content}\n\n❌ Proposal rejected.` } : m));
  };

  return (
    <div>
      <PageHeader title="AI Assistant" description="Record transactions and ask questions in natural language" action={<AiModeBadge mode="demo" />} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[600px]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role !== 'user' && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 flex-shrink-0"><Bot className="h-5 w-5 text-white" /></div>}
                  <div className={cn('max-w-[80%] rounded-xl p-3 text-sm', msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800')}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.proposal && msg.proposalId && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        {msg.proposal.resolvedProducts && msg.proposal.resolvedProducts.length > 0 && (
                          <div className="text-xs">
                            <p className="font-medium text-slate-600">Product resolved to:</p>
                            {msg.proposal.resolvedProducts.map((rp) => (
                              <p key={rp.product.id} className="text-slate-700">{rp.product.name} - Stock: {rp.product.quantity_on_hand} - Price: {formatCurrency(rp.product.selling_price, business?.currency)}</p>
                            ))}
                          </div>
                        )}
                        {msg.proposal.resolvedCustomer && <p className="text-xs text-slate-600">Customer: {msg.proposal.resolvedCustomer.name}</p>}
                        {msg.proposal.resolvedSupplier && <p className="text-xs text-slate-600">Supplier: {msg.proposal.resolvedSupplier.name}</p>}
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" loading={executing} onClick={() => handleConfirm(msg)}><Check className="h-3.5 w-3.5" /> Confirm</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(msg)}><X className="h-3.5 w-3.5" /> Reject</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {processing && <div className="flex gap-3 justify-start"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900"><Bot className="h-5 w-5 text-white" /></div><div className="bg-slate-100 rounded-xl p-3"><Spinner className="h-4 w-4" /></div></div>}
            </div>
            <div className="border-t border-slate-200 p-3 flex gap-2">
              <input className="flex-1 h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900" placeholder="Type a command or question..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} disabled={processing} />
              <Button onClick={() => handleSend()} disabled={processing || !input.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Sample Commands</h3>
            <div className="space-y-2">
              {sampleCommands.map((cmd, i) => (
                <button key={i} onClick={() => handleSend(cmd)} className="w-full text-left text-xs rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  {cmd}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-slate-700">Demo Mode</p>
                <p className="text-xs text-slate-500 mt-1">The AI uses a deterministic rule-based parser, not a live LLM. It supports common English and Roman Urdu commands. All financial operations require your confirmation before executing.</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-3">What I Can Do</h3>
            <div className="space-y-2 text-xs text-slate-600">
              <p className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5 text-emerald-600" /> Record sales, purchases, expenses</p>
              <p className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-blue-600" /> Answer sales and profit questions</p>
              <p className="flex items-center gap-2"><Package className="h-3.5 w-3.5 text-amber-600" /> Check low stock and inventory</p>
              <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-purple-600" /> Show customer balances</p>
              <p className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-slate-600" /> Show supplier payables</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
