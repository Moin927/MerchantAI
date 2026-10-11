export interface Business {
  id: string;
  name: string;
  business_type: string;
  currency: string;
  timezone: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  business_id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'staff';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku: string;
  description: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  quantity_on_hand: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  movement_type: 'stock_in' | 'stock_out' | 'adjustment' | 'sale' | 'purchase' | 'refund';
  quantity_delta: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  product?: Product;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type TransactionType = 'sale' | 'purchase' | 'expense' | 'customer_payment' | 'supplier_payment' | 'refund';
export type TransactionStatus = 'completed' | 'cancelled' | 'pending';

export interface Transaction {
  id: string;
  business_id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  customer_id: string | null;
  supplier_id: string | null;
  status: TransactionStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  notes: string;
  idempotency_key: string | null;
  created_by: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  supplier?: Supplier;
  items?: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost_snapshot: number;
  line_total: number;
  product?: Product;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  business_id: string;
  customer_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  issue_date: string;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Payment {
  id: string;
  business_id: string;
  invoice_id: string | null;
  transaction_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  payment_method: 'cash' | 'bank' | 'card' | 'solana' | 'other';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'verified';
  external_reference: string;
  idempotency_key: string | null;
  paid_at: string;
  created_at: string;
  customer?: Customer;
  supplier?: Supplier;
}

export interface SolanaPaymentRecord {
  id: string;
  business_id: string;
  invoice_id: string;
  payment_id: string | null;
  network: string;
  token_mint: string;
  expected_sender: string;
  recipient_wallet: string;
  expected_amount: number;
  transaction_signature: string | null;
  status: 'pending' | 'verified' | 'failed' | 'simulated';
  verified_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  safe_metadata: Record<string, unknown>;
  created_at: string;
}

export interface AiProposal {
  id: string;
  business_id: string;
  user_id: string;
  original_text: string;
  parsed_intent: ParsedIntent;
  status: 'pending' | 'confirmed' | 'executed' | 'rejected' | 'expired';
  executed_transaction_id: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface ParsedIntent {
  intent: string;
  transaction_type: TransactionType | null;
  products: { name: string; quantity: number; unit_price?: number }[];
  customer_name?: string;
  supplier_name?: string;
  amount_paid?: number;
  total_amount?: number;
  discount?: number;
  tax?: number;
  notes?: string;
  missing_fields: string[];
  warnings: string[];
  summary: string;
}

export interface DashboardMetrics {
  total_sales: number;
  total_purchases: number;
  total_expenses: number;
  cogs: number;
  gross_profit: number;
  net_profit: number;
  sales_count: number;
  inventory_value: number;
  total_receivables: number;
  total_payables: number;
  low_stock_count: number;
  start_date: string;
  end_date: string;
}
