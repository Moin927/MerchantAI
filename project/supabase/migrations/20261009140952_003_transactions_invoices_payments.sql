/*
# Core Business Schema - Part 3: Transactions, Transaction Items, Invoices, Invoice Items, Payments

1. New Tables
- transactions: Sales, purchases, expenses, payments with totals (numeric)
- transaction_items: Line items with price/cost snapshots
- invoices: Invoice records with status lifecycle
- invoice_items: Invoice line items
- payments: Payment records with idempotency

2. Security
- RLS enabled on all tables, business-scoped via profiles membership

3. Notes
- All money columns are numeric(14,2)
- transaction_items store unit_cost_snapshot so historical reports stay accurate
- idempotency_key on transactions prevents duplicate submissions
*/

-- ============ TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transaction_number text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('sale', 'purchase', 'expense', 'customer_payment', 'supplier_payment', 'refund')),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'pending')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  amount_due numeric(14,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  idempotency_key text DEFAULT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, idempotency_key)
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = transactions.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = transactions.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = transactions.business_id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = transactions.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = transactions.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_txn_business ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(business_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_txn_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_txn_supplier ON transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_txn_occurred ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(business_id, status);

-- ============ TRANSACTION ITEMS ============
CREATE TABLE IF NOT EXISTS transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  unit_cost_snapshot numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0
);

ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_txn_items" ON transaction_items;
CREATE POLICY "select_own_txn_items" ON transaction_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
     JOIN transactions t ON t.business_id = p.business_id
     WHERE t.id = transaction_items.transaction_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_txn_items" ON transaction_items;
CREATE POLICY "insert_own_txn_items" ON transaction_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p
     JOIN transactions t ON t.business_id = p.business_id
     WHERE t.id = transaction_items.transaction_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_txn_items" ON transaction_items;
CREATE POLICY "update_own_txn_items" ON transaction_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
     JOIN transactions t ON t.business_id = p.business_id
     WHERE t.id = transaction_items.transaction_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p
     JOIN transactions t ON t.business_id = p.business_id
     WHERE t.id = transaction_items.transaction_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_txn_items" ON transaction_items;
CREATE POLICY "delete_own_txn_items" ON transaction_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
     JOIN transactions t ON t.business_id = p.business_id
     WHERE t.id = transaction_items.transaction_id AND p.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_txn_items_txn ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_txn_items_product ON transaction_items(product_id);

-- ============ INVOICES ============
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  amount_due numeric(14,2) NOT NULL DEFAULT 0,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_invoices" ON invoices;
CREATE POLICY "select_own_invoices" ON invoices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = invoices.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_invoices" ON invoices;
CREATE POLICY "insert_own_invoices" ON invoices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = invoices.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_invoices" ON invoices;
CREATE POLICY "update_own_invoices" ON invoices FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = invoices.business_id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = invoices.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_invoices" ON invoices;
CREATE POLICY "delete_own_invoices" ON invoices FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = invoices.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_inv_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_inv_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_due_date ON invoices(due_date);

-- ============ INVOICE ITEMS ============
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_inv_items" ON invoice_items;
CREATE POLICY "select_own_inv_items" ON invoice_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
     JOIN invoices i ON i.business_id = p.business_id
     WHERE i.id = invoice_items.invoice_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_inv_items" ON invoice_items;
CREATE POLICY "insert_own_inv_items" ON invoice_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p
     JOIN invoices i ON i.business_id = p.business_id
     WHERE i.id = invoice_items.invoice_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_inv_items" ON invoice_items;
CREATE POLICY "update_own_inv_items" ON invoice_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
     JOIN invoices i ON i.business_id = p.business_id
     WHERE i.id = invoice_items.invoice_id AND p.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p
     JOIN invoices i ON i.business_id = p.business_id
     WHERE i.id = invoice_items.invoice_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_inv_items" ON invoice_items;
CREATE POLICY "delete_own_inv_items" ON invoice_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p
     JOIN invoices i ON i.business_id = p.business_id
     WHERE i.id = invoice_items.invoice_id AND p.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_inv_items_inv ON invoice_items(invoice_id);

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank', 'card', 'solana', 'other')),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PKR',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'verified')),
  external_reference text DEFAULT '',
  idempotency_key text DEFAULT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, idempotency_key)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = payments.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_payments" ON payments;
CREATE POLICY "insert_own_payments" ON payments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = payments.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_payments" ON payments;
CREATE POLICY "update_own_payments" ON payments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = payments.business_id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = payments.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_payments" ON payments;
CREATE POLICY "delete_own_payments" ON payments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = payments.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_pay_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_pay_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pay_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_supplier ON payments(supplier_id);
