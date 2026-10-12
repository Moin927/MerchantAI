-- ========================================================
-- MerchantAI Complete Database Schema & Functions
-- Run this single file in Supabase SQL Editor
-- ========================================================

-- >>>>> 20261009140816_001_businesses_profiles.sql <<<<<
/*
# Core Business Schema - Part 1: Businesses and Profiles

1. New Tables
- businesses: Top-level business entity (name, type, currency, timezone, owner)
- profiles: User profiles linked to auth.users with role in a business

2. Security
- RLS enabled on all tables
- Owner-scoped via business_id with membership check against profiles
- profiles scoped to the authenticated user directly

3. Notes
- Money columns use numeric(14,2) - never floating point
- Timestamps are timestamptz, timezone-aware
*/

-- ============ BUSINESSES ============
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_type text DEFAULT 'retail',
  currency text NOT NULL DEFAULT 'PKR',
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, business_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Now add policies (profiles must exist for business membership checks)

-- Businesses: users can see/manage businesses they are a member of
DROP POLICY IF EXISTS "select_own_business" ON businesses;
CREATE POLICY "select_own_business" ON businesses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = businesses.id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_business" ON businesses;
CREATE POLICY "insert_own_business" ON businesses FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_business" ON businesses;
CREATE POLICY "update_own_business" ON businesses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = businesses.id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = businesses.id AND profiles.user_id = auth.uid())
  );

-- Profiles: users can see/edit only their own profile
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (user_id = auth.uid());


-- >>>>> 20261009140853_002_products_inventory_contacts.sql <<<<<
/*
# Core Business Schema - Part 2: Products, Inventory, Customers, Suppliers

1. New Tables
- products: Products with SKU, pricing (numeric), stock levels
- inventory_movements: Audit trail for every stock change
- customers: Customer records with contact info
- suppliers: Supplier records with contact info

2. Security
- RLS enabled on all tables
- Owner-scoped via business_id with membership check against profiles

3. Notes
- Money columns use numeric(14,2) - never floating point
- Inventory movements track every stock change with quantity_delta
*/

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text NOT NULL DEFAULT '',
  description text DEFAULT '',
  unit text NOT NULL DEFAULT 'piece',
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  selling_price numeric(14,2) NOT NULL DEFAULT 0,
  quantity_on_hand numeric(14,2) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(14,2) NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = products.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = products.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = products.business_id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = products.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = products.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(business_id, name);

-- ============ INVENTORY MOVEMENTS ============
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('stock_in', 'stock_out', 'adjustment', 'sale', 'purchase', 'refund')),
  quantity_delta numeric(14,2) NOT NULL,
  reference_type text DEFAULT NULL,
  reference_id uuid DEFAULT NULL,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_inventory" ON inventory_movements;
CREATE POLICY "select_own_inventory" ON inventory_movements FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = inventory_movements.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_inventory" ON inventory_movements;
CREATE POLICY "insert_own_inventory" ON inventory_movements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = inventory_movements.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_inv_mov_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_business ON inventory_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created ON inventory_movements(created_at);

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = customers.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = customers.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = customers.business_id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = customers.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = customers.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

-- ============ SUPPLIERS ============
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_suppliers" ON suppliers;
CREATE POLICY "select_own_suppliers" ON suppliers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = suppliers.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_suppliers" ON suppliers;
CREATE POLICY "insert_own_suppliers" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = suppliers.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_suppliers" ON suppliers;
CREATE POLICY "update_own_suppliers" ON suppliers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = suppliers.business_id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = suppliers.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_suppliers" ON suppliers;
CREATE POLICY "delete_own_suppliers" ON suppliers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = suppliers.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);


-- >>>>> 20261009140952_003_transactions_invoices_payments.sql <<<<<
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


-- >>>>> 20261009141018_004_solana_audit_proposals.sql <<<<<
/*
# Core Business Schema - Part 4: Solana Payment Records, Audit Log, AI Proposals

1. New Tables
- solana_payment_records: Track Solana Devnet payment attempts and verification
- audit_logs: Audit trail of significant business actions
- ai_proposals: Store AI-parsed transaction proposals pending confirmation

2. Security
- RLS enabled on all tables, business-scoped via profiles membership

3. Notes
- solana_payment_records NEVER stores private keys
- ai_proposals stores the parsed proposal before user confirmation, then links to the executed transaction
*/

-- ============ SOLANA PAYMENT RECORDS ============
CREATE TABLE IF NOT EXISTS solana_payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  network text NOT NULL DEFAULT 'devnet',
  token_mint text DEFAULT '',
  expected_sender text DEFAULT '',
  recipient_wallet text NOT NULL,
  expected_amount numeric(14,2) NOT NULL DEFAULT 0,
  transaction_signature text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'simulated')),
  verified_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE solana_payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_solana" ON solana_payment_records;
CREATE POLICY "select_own_solana" ON solana_payment_records FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = solana_payment_records.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_solana" ON solana_payment_records;
CREATE POLICY "insert_own_solana" ON solana_payment_records FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = solana_payment_records.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_solana" ON solana_payment_records;
CREATE POLICY "update_own_solana" ON solana_payment_records FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = solana_payment_records.business_id AND profiles.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = solana_payment_records.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_solana_business ON solana_payment_records(business_id);
CREATE INDEX IF NOT EXISTS idx_solana_invoice ON solana_payment_records(invoice_id);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid DEFAULT NULL,
  safe_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit" ON audit_logs;
CREATE POLICY "select_own_audit" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = audit_logs.business_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_audit" ON audit_logs;
CREATE POLICY "insert_own_audit" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.business_id = audit_logs.business_id AND profiles.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============ AI PROPOSALS ============
CREATE TABLE IF NOT EXISTS ai_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text text NOT NULL,
  parsed_intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'executed', 'rejected', 'expired')),
  executed_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz DEFAULT NULL
);

ALTER TABLE ai_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_proposals" ON ai_proposals;
CREATE POLICY "select_own_proposals" ON ai_proposals FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_proposals" ON ai_proposals;
CREATE POLICY "insert_own_proposals" ON ai_proposals FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_proposals" ON ai_proposals;
CREATE POLICY "update_own_proposals" ON ai_proposals FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_proposals" ON ai_proposals;
CREATE POLICY "delete_own_proposals" ON ai_proposals FOR DELETE
  TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_proposals_user ON ai_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON ai_proposals(status);


-- >>>>> 20261009141116_005_financial_functions.sql <<<<<
/*
# Stored Functions for Financial Operations

1. Functions
- get_business_id(): Returns the business_id for the authenticated user
- create_sale(p_items, p_customer_id, ...): Creates a sale, updates inventory, records items
- create_purchase(p_items, p_supplier_id, ...): Creates a purchase, updates inventory
- create_expense(p_amount, p_description, ...): Records an expense
- record_customer_payment(p_customer_id, p_amount, ...): Records a customer payment
- record_supplier_payment(p_supplier_id, p_amount, ...): Records a supplier payment
- get_dashboard_metrics(p_start_date, p_end_date): Returns aggregated metrics
- get_customer_balance(p_customer_id): Returns outstanding balance for a customer
- get_supplier_balance(p_supplier_id): Returns outstanding balance for a supplier

2. Security
- All functions run as SECURITY DEFINER to perform atomic operations
- Each function checks business membership before operating
- Functions validate inputs and enforce business rules

3. Notes
- All money calculations use numeric arithmetic, never float
- Inventory updates happen atomically within the same operation
- Idempotency keys prevent duplicate submissions
*/

-- Helper: get business_id for current user
CREATE OR REPLACE FUNCTION get_business_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============ CREATE SALE ============
CREATE OR REPLACE FUNCTION create_sale(
  p_customer_id uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_amount_paid numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_idempotency_key text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_txn_id uuid;
  v_txn_number text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_amount_due numeric(14,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric(14,2);
  v_unit_price numeric(14,2);
  v_unit_cost numeric(14,2);
  v_line_total numeric(14,2);
  v_current_stock numeric(14,2);
  v_product_name text;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn_id FROM transactions
      WHERE business_id = v_business_id AND idempotency_key = p_idempotency_key;
    IF v_txn_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_txn_id, 'message', 'Duplicate submission prevented');
    END IF;
  END IF;

  -- Generate transaction number
  v_txn_number := 'SALE-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::numeric(14,2);
    v_unit_price := (v_item->>'unit_price')::numeric(14,2);
    v_line_total := v_qty * v_unit_price;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_total := v_subtotal - p_discount_amount + p_tax_amount;
  v_amount_due := v_total - p_amount_paid;

  -- Insert transaction
  INSERT INTO transactions (
    business_id, transaction_number, transaction_type, customer_id,
    status, subtotal, discount_amount, tax_amount, total_amount,
    amount_paid, amount_due, notes, idempotency_key, created_by, occurred_at
  ) VALUES (
    v_business_id, v_txn_number, 'sale', p_customer_id,
    'completed', v_subtotal, p_discount_amount, p_tax_amount, v_total,
    p_amount_paid, v_amount_due, p_notes, p_idempotency_key, auth.uid(), p_occurred_at
  ) RETURNING id INTO v_txn_id;

  -- Insert items and update inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric(14,2);
    v_unit_price := (v_item->>'unit_price')::numeric(14,2);
    v_line_total := v_qty * v_unit_price;

    -- Get current cost and stock
    SELECT cost_price, quantity_on_hand, name INTO v_unit_cost, v_current_stock, v_product_name
      FROM products WHERE id = v_product_id AND business_id = v_business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product "%". Available: %, Requested: %', v_product_name, v_current_stock, v_qty;
    END IF;

    -- Insert transaction item with cost snapshot
    INSERT INTO transaction_items (
      transaction_id, product_id, description, quantity,
      unit_price, unit_cost_snapshot, line_total
    ) VALUES (
      v_txn_id, v_product_id, v_product_name, v_qty,
      v_unit_price, v_unit_cost, v_line_total
    );

    -- Update product stock
    UPDATE products SET quantity_on_hand = quantity_on_hand - v_qty, updated_at = now()
      WHERE id = v_product_id;

    -- Record inventory movement
    INSERT INTO inventory_movements (
      business_id, product_id, movement_type, quantity_delta,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_business_id, v_product_id, 'sale', -v_qty,
      'transaction', v_txn_id, 'Sale: ' || v_txn_number, auth.uid()
    );
  END LOOP;

  -- Record payment if amount_paid > 0
  IF p_amount_paid > 0 THEN
    INSERT INTO payments (
      business_id, transaction_id, customer_id, payment_method,
      amount, status, paid_at
    ) VALUES (
      v_business_id, v_txn_id, p_customer_id, 'cash',
      p_amount_paid, 'completed', p_occurred_at
    );
  END IF;

  RETURN jsonb_build_object('id', v_txn_id, 'transaction_number', v_txn_number,
    'subtotal', v_subtotal, 'total_amount', v_total, 'amount_paid', p_amount_paid,
    'amount_due', v_amount_due);
END;
$$;

-- ============ CREATE PURCHASE ============
CREATE OR REPLACE FUNCTION create_purchase(
  p_supplier_id uuid DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_amount_paid numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_idempotency_key text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_txn_id uuid;
  v_txn_number text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_amount_due numeric(14,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric(14,2);
  v_unit_price numeric(14,2);
  v_line_total numeric(14,2);
  v_product_name text;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn_id FROM transactions
      WHERE business_id = v_business_id AND idempotency_key = p_idempotency_key;
    IF v_txn_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_txn_id, 'message', 'Duplicate submission prevented');
    END IF;
  END IF;

  v_txn_number := 'PUR-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::numeric(14,2);
    v_unit_price := (v_item->>'unit_price')::numeric(14,2);
    v_line_total := v_qty * v_unit_price;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_total := v_subtotal - p_discount_amount + p_tax_amount;
  v_amount_due := v_total - p_amount_paid;

  INSERT INTO transactions (
    business_id, transaction_number, transaction_type, supplier_id,
    status, subtotal, discount_amount, tax_amount, total_amount,
    amount_paid, amount_due, notes, idempotency_key, created_by, occurred_at
  ) VALUES (
    v_business_id, v_txn_number, 'purchase', p_supplier_id,
    'completed', v_subtotal, p_discount_amount, p_tax_amount, v_total,
    p_amount_paid, v_amount_due, p_notes, p_idempotency_key, auth.uid(), p_occurred_at
  ) RETURNING id INTO v_txn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric(14,2);
    v_unit_price := (v_item->>'unit_price')::numeric(14,2);
    v_line_total := v_qty * v_unit_price;

    SELECT name INTO v_product_name FROM products WHERE id = v_product_id AND business_id = v_business_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
    END IF;

    INSERT INTO transaction_items (
      transaction_id, product_id, description, quantity,
      unit_price, unit_cost_snapshot, line_total
    ) VALUES (
      v_txn_id, v_product_id, v_product_name, v_qty,
      v_unit_price, v_unit_price, v_line_total
    );

    UPDATE products SET quantity_on_hand = quantity_on_hand + v_qty, updated_at = now()
      WHERE id = v_product_id;

    INSERT INTO inventory_movements (
      business_id, product_id, movement_type, quantity_delta,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      v_business_id, v_product_id, 'purchase', v_qty,
      'transaction', v_txn_id, 'Purchase: ' || v_txn_number, auth.uid()
    );
  END LOOP;

  IF p_amount_paid > 0 THEN
    INSERT INTO payments (
      business_id, transaction_id, supplier_id, payment_method,
      amount, status, paid_at
    ) VALUES (
      v_business_id, v_txn_id, p_supplier_id, 'cash',
      p_amount_paid, 'completed', p_occurred_at
    );
  END IF;

  RETURN jsonb_build_object('id', v_txn_id, 'transaction_number', v_txn_number,
    'subtotal', v_subtotal, 'total_amount', v_total, 'amount_paid', p_amount_paid,
    'amount_due', v_amount_due);
END;
$$;

-- ============ CREATE EXPENSE ============
CREATE OR REPLACE FUNCTION create_expense(
  p_description text,
  p_amount numeric,
  p_category text DEFAULT 'general',
  p_supplier_id uuid DEFAULT NULL,
  p_notes text DEFAULT '',
  p_idempotency_key text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_txn_id uuid;
  v_txn_number text;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be positive';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn_id FROM transactions
      WHERE business_id = v_business_id AND idempotency_key = p_idempotency_key;
    IF v_txn_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_txn_id, 'message', 'Duplicate submission prevented');
    END IF;
  END IF;

  v_txn_number := 'EXP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO transactions (
    business_id, transaction_number, transaction_type, supplier_id,
    status, subtotal, total_amount, amount_paid, amount_due,
    notes, idempotency_key, created_by, occurred_at
  ) VALUES (
    v_business_id, v_txn_number, 'expense', p_supplier_id,
    'completed', p_amount, p_amount, p_amount, 0,
    p_notes, p_idempotency_key, auth.uid(), p_occurred_at
  ) RETURNING id INTO v_txn_id;

  INSERT INTO transaction_items (
    transaction_id, description, quantity, unit_price, unit_cost_snapshot, line_total
  ) VALUES (
    v_txn_id, p_description, 1, p_amount, p_amount, p_amount
  );

  RETURN jsonb_build_object('id', v_txn_id, 'transaction_number', v_txn_number,
    'total_amount', p_amount);
END;
$$;

-- ============ RECORD CUSTOMER PAYMENT ============
CREATE OR REPLACE FUNCTION record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_invoice_id uuid DEFAULT NULL,
  p_notes text DEFAULT '',
  p_idempotency_key text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_txn_id uuid;
  v_txn_number text;
  v_payment_id uuid;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn_id FROM transactions
      WHERE business_id = v_business_id AND idempotency_key = p_idempotency_key;
    IF v_txn_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_txn_id, 'message', 'Duplicate submission prevented');
    END IF;
  END IF;

  v_txn_number := 'CPAY-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO transactions (
    business_id, transaction_number, transaction_type, customer_id,
    status, subtotal, total_amount, amount_paid, amount_due,
    notes, idempotency_key, created_by, occurred_at
  ) VALUES (
    v_business_id, v_txn_number, 'customer_payment', p_customer_id,
    'completed', p_amount, p_amount, p_amount, 0,
    p_notes, p_idempotency_key, auth.uid(), p_paid_at
  ) RETURNING id INTO v_txn_id;

  INSERT INTO payments (
    business_id, transaction_id, customer_id, invoice_id,
    payment_method, amount, status, paid_at
  ) VALUES (
    v_business_id, v_txn_id, p_customer_id, p_invoice_id,
    p_payment_method, p_amount, 'completed', p_paid_at
  ) RETURNING id INTO v_payment_id;

  -- Update invoice if linked
  IF p_invoice_id IS NOT NULL THEN
    UPDATE invoices SET
      amount_paid = amount_paid + p_amount,
      amount_due = amount_due - p_amount,
      status = CASE
        WHEN amount_due - p_amount <= 0 THEN 'paid'
        WHEN amount_paid + p_amount > 0 THEN 'partially_paid'
        ELSE status
      END,
      updated_at = now()
    WHERE id = p_invoice_id AND business_id = v_business_id;
  END IF;

  RETURN jsonb_build_object('id', v_txn_id, 'payment_id', v_payment_id,
    'transaction_number', v_txn_number, 'amount', p_amount);
END;
$$;

-- ============ RECORD SUPPLIER PAYMENT ============
CREATE OR REPLACE FUNCTION record_supplier_payment(
  p_supplier_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_notes text DEFAULT '',
  p_idempotency_key text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_txn_id uuid;
  v_txn_number text;
  v_payment_id uuid;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_txn_id FROM transactions
      WHERE business_id = v_business_id AND idempotency_key = p_idempotency_key;
    IF v_txn_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_txn_id, 'message', 'Duplicate submission prevented');
    END IF;
  END IF;

  v_txn_number := 'SPAY-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO transactions (
    business_id, transaction_number, transaction_type, supplier_id,
    status, subtotal, total_amount, amount_paid, amount_due,
    notes, idempotency_key, created_by, occurred_at
  ) VALUES (
    v_business_id, v_txn_number, 'supplier_payment', p_supplier_id,
    'completed', p_amount, p_amount, p_amount, 0,
    p_notes, p_idempotency_key, auth.uid(), p_paid_at
  ) RETURNING id INTO v_txn_id;

  INSERT INTO payments (
    business_id, transaction_id, supplier_id,
    payment_method, amount, status, paid_at
  ) VALUES (
    v_business_id, v_txn_id, p_supplier_id,
    p_payment_method, p_amount, 'completed', p_paid_at
  ) RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object('id', v_txn_id, 'payment_id', v_payment_id,
    'transaction_number', v_txn_number, 'amount', p_amount);
END;
$$;


-- >>>>> 20261009141241_006_reporting_functions.sql <<<<<
/*
# Dashboard Metrics and Reporting Functions

1. Functions
- get_dashboard_metrics(p_start_date, p_end_date): Returns sales, expenses, profit, etc.
- get_customer_balance(p_customer_id): Returns outstanding receivable for a customer
- get_supplier_balance(p_supplier_id): Returns outstanding payable for a supplier
- get_low_stock_products(): Returns products below threshold
- get_top_products(p_limit): Returns best-selling products by quantity/revenue
- get_monthly_comparison(): Returns current vs last month comparison
- get_inventory_value(): Returns total inventory value at cost
- get_outstanding_receivables(): Returns all customers with outstanding balances
- get_outstanding_payables(): Returns all suppliers with outstanding balances
- get_invoice_summary(): Returns invoice status counts

2. Security
- All functions are SECURITY DEFINER, scoped to the authenticated user's business
- Functions use get_business_id() for business isolation

3. Notes
- Revenue = sum of completed sales
- COGS = sum of unit_cost_snapshot * quantity for sale items
- Gross profit = revenue - COGS
- Operating expenses = sum of expense transactions
- Net profit estimate = gross profit - operating expenses
*/

-- ============ DASHBOARD METRICS ============
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_total_sales numeric(14,2) := 0;
  v_total_purchases numeric(14,2) := 0;
  v_total_expenses numeric(14,2) := 0;
  v_cogs numeric(14,2) := 0;
  v_gross_profit numeric(14,2) := 0;
  v_net_profit numeric(14,2) := 0;
  v_sales_count int := 0;
  v_inventory_value numeric(14,2) := 0;
  v_total_receivables numeric(14,2) := 0;
  v_total_payables numeric(14,2) := 0;
  v_low_stock_count int := 0;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  -- Total sales
  SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
    INTO v_total_sales, v_sales_count
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'sale'
    AND status = 'completed'
    AND occurred_at::date BETWEEN p_start_date AND p_end_date;

  -- COGS from sale items
  SELECT COALESCE(SUM(unit_cost_snapshot * quantity), 0)
    INTO v_cogs
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE t.business_id = v_business_id
    AND t.transaction_type = 'sale'
    AND t.status = 'completed'
    AND t.occurred_at::date BETWEEN p_start_date AND p_end_date;

  -- Total purchases
  SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_purchases
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'purchase'
    AND status = 'completed'
    AND occurred_at::date BETWEEN p_start_date AND p_end_date;

  -- Total expenses
  SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_expenses
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'expense'
    AND status = 'completed'
    AND occurred_at::date BETWEEN p_start_date AND p_end_date;

  v_gross_profit := v_total_sales - v_cogs;
  v_net_profit := v_gross_profit - v_total_expenses;

  -- Inventory value at cost
  SELECT COALESCE(SUM(quantity_on_hand * cost_price), 0)
    INTO v_inventory_value
  FROM products
  WHERE business_id = v_business_id AND is_active = true;

  -- Total receivables (unpaid customer balances)
  SELECT COALESCE(SUM(amount_due), 0)
    INTO v_total_receivables
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'sale'
    AND status = 'completed'
    AND amount_due > 0;

  -- Total payables (unpaid supplier balances)
  SELECT COALESCE(SUM(amount_due), 0)
    INTO v_total_payables
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'purchase'
    AND status = 'completed'
    AND amount_due > 0;

  -- Low stock count
  SELECT COUNT(*)
    INTO v_low_stock_count
  FROM products
  WHERE business_id = v_business_id
    AND is_active = true
    AND quantity_on_hand <= low_stock_threshold;

  RETURN jsonb_build_object(
    'total_sales', v_total_sales,
    'total_purchases', v_total_purchases,
    'total_expenses', v_total_expenses,
    'cogs', v_cogs,
    'gross_profit', v_gross_profit,
    'net_profit', v_net_profit,
    'sales_count', v_sales_count,
    'inventory_value', v_inventory_value,
    'total_receivables', v_total_receivables,
    'total_payables', v_total_payables,
    'low_stock_count', v_low_stock_count,
    'start_date', p_start_date,
    'end_date', p_end_date
  );
END;
$$;

-- ============ CUSTOMER BALANCE ============
CREATE OR REPLACE FUNCTION get_customer_balance(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_total_sales numeric(14,2) := 0;
  v_total_payments numeric(14,2) := 0;
  v_balance numeric(14,2) := 0;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  SELECT COALESCE(SUM(amount_due), 0) INTO v_total_sales
  FROM transactions
  WHERE business_id = v_business_id
    AND customer_id = p_customer_id
    AND transaction_type = 'sale'
    AND status = 'completed';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_payments
  FROM transactions
  WHERE business_id = v_business_id
    AND customer_id = p_customer_id
    AND transaction_type = 'customer_payment'
    AND status = 'completed';

  v_balance := v_total_sales - v_total_payments;

  RETURN jsonb_build_object(
    'customer_id', p_customer_id,
    'total_sales_with_credit', v_total_sales,
    'total_payments', v_total_payments,
    'balance', v_balance
  );
END;
$$;

-- ============ SUPPLIER BALANCE ============
CREATE OR REPLACE FUNCTION get_supplier_balance(p_supplier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_total_purchases numeric(14,2) := 0;
  v_total_payments numeric(14,2) := 0;
  v_balance numeric(14,2) := 0;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  SELECT COALESCE(SUM(amount_due), 0) INTO v_total_purchases
  FROM transactions
  WHERE business_id = v_business_id
    AND supplier_id = p_supplier_id
    AND transaction_type = 'purchase'
    AND status = 'completed';

  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_payments
  FROM transactions
  WHERE business_id = v_business_id
    AND supplier_id = p_supplier_id
    AND transaction_type = 'supplier_payment'
    AND status = 'completed';

  v_balance := v_total_purchases - v_total_payments;

  RETURN jsonb_build_object(
    'supplier_id', p_supplier_id,
    'total_purchases_with_credit', v_total_purchases,
    'total_payments', v_total_payments,
    'balance', v_balance
  );
END;
$$;

-- ============ LOW STOCK PRODUCTS ============
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
  id uuid, name text, sku text, quantity_on_hand numeric, low_stock_threshold numeric,
  cost_price numeric, selling_price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.sku, p.quantity_on_hand, p.low_stock_threshold,
         p.cost_price, p.selling_price
  FROM products p
  WHERE p.business_id = v_business_id
    AND p.is_active = true
    AND p.quantity_on_hand <= p.low_stock_threshold
  ORDER BY p.quantity_on_hand ASC;
END;
$$;

-- ============ TOP PRODUCTS ============
CREATE OR REPLACE FUNCTION get_top_products(p_limit int DEFAULT 5)
RETURNS TABLE (
  product_id uuid, product_name text, total_quantity numeric, total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  RETURN QUERY
  SELECT ti.product_id,
         ti.description,
         COALESCE(SUM(ti.quantity), 0) AS total_quantity,
         COALESCE(SUM(ti.line_total), 0) AS total_revenue
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE t.business_id = v_business_id
    AND t.transaction_type = 'sale'
    AND t.status = 'completed'
    AND ti.product_id IS NOT NULL
  GROUP BY ti.product_id, ti.description
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$;

-- ============ MONTHLY COMPARISON ============
CREATE OR REPLACE FUNCTION get_monthly_comparison()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_this_month_sales numeric(14,2) := 0;
  v_last_month_sales numeric(14,2) := 0;
  v_this_month_expenses numeric(14,2) := 0;
  v_last_month_expenses numeric(14,2) := 0;
  v_this_month_purchases numeric(14,2) := 0;
  v_last_month_purchases numeric(14,2) := 0;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_this_month_sales
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'sale' AND status = 'completed'
    AND occurred_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(total_amount), 0) INTO v_last_month_sales
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'sale' AND status = 'completed'
    AND occurred_at >= date_trunc('month', now() - interval '1 month')
    AND occurred_at < date_trunc('month', now());

  SELECT COALESCE(SUM(total_amount), 0) INTO v_this_month_expenses
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'expense' AND status = 'completed'
    AND occurred_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(total_amount), 0) INTO v_last_month_expenses
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'expense' AND status = 'completed'
    AND occurred_at >= date_trunc('month', now() - interval '1 month')
    AND occurred_at < date_trunc('month', now());

  SELECT COALESCE(SUM(total_amount), 0) INTO v_this_month_purchases
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'purchase' AND status = 'completed'
    AND occurred_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(total_amount), 0) INTO v_last_month_purchases
  FROM transactions
  WHERE business_id = v_business_id
    AND transaction_type = 'purchase' AND status = 'completed'
    AND occurred_at >= date_trunc('month', now() - interval '1 month')
    AND occurred_at < date_trunc('month', now());

  RETURN jsonb_build_object(
    'this_month', jsonb_build_object(
      'sales', v_this_month_sales,
      'expenses', v_this_month_expenses,
      'purchases', v_this_month_purchases
    ),
    'last_month', jsonb_build_object(
      'sales', v_last_month_sales,
      'expenses', v_last_month_expenses,
      'purchases', v_last_month_purchases
    ),
    'sales_change_pct', CASE WHEN v_last_month_sales > 0
      THEN ROUND(((v_this_month_sales - v_last_month_sales) / v_last_month_sales * 100)::numeric, 2)
      ELSE NULL END,
    'expenses_change_pct', CASE WHEN v_last_month_expenses > 0
      THEN ROUND(((v_this_month_expenses - v_last_month_expenses) / v_last_month_expenses * 100)::numeric, 2)
      ELSE NULL END
  );
END;
$$;

-- ============ OUTSTANDING RECEIVABLES ============
CREATE OR REPLACE FUNCTION get_outstanding_receivables()
RETURNS TABLE (
  customer_id uuid, customer_name text, balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'sale' THEN t.amount_due ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'customer_payment' THEN t.total_amount ELSE 0 END), 0) AS balance
  FROM customers c
  LEFT JOIN transactions t ON t.customer_id = c.id
    AND t.status = 'completed'
    AND t.transaction_type IN ('sale', 'customer_payment')
  WHERE c.business_id = v_business_id
  GROUP BY c.id, c.name
  HAVING
    COALESCE(SUM(CASE WHEN t.transaction_type = 'sale' THEN t.amount_due ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'customer_payment' THEN t.total_amount ELSE 0 END), 0) > 0
  ORDER BY balance DESC;
END;
$$;

-- ============ OUTSTANDING PAYABLES ============
CREATE OR REPLACE FUNCTION get_outstanding_payables()
RETURNS TABLE (
  supplier_id uuid, supplier_name text, balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  RETURN QUERY
  SELECT s.id, s.name,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'purchase' THEN t.amount_due ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'supplier_payment' THEN t.total_amount ELSE 0 END), 0) AS balance
  FROM suppliers s
  LEFT JOIN transactions t ON t.supplier_id = s.id
    AND t.status = 'completed'
    AND t.transaction_type IN ('purchase', 'supplier_payment')
  WHERE s.business_id = v_business_id
  GROUP BY s.id, s.name
  HAVING
    COALESCE(SUM(CASE WHEN t.transaction_type = 'purchase' THEN t.amount_due ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'supplier_payment' THEN t.total_amount ELSE 0 END), 0) > 0
  ORDER BY balance DESC;
END;
$$;

-- ============ INVOICE SUMMARY ============
CREATE OR REPLACE FUNCTION get_invoice_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_draft int := 0;
  v_issued int := 0;
  v_partially_paid int := 0;
  v_paid int := 0;
  v_overdue int := 0;
  v_total_outstanding numeric(14,2) := 0;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  -- Update overdue status
  UPDATE invoices SET status = 'overdue', updated_at = now()
  WHERE business_id = v_business_id
    AND status IN ('issued', 'partially_paid')
    AND due_date < CURRENT_DATE
    AND amount_due > 0;

  SELECT
    COUNT(*) FILTER (WHERE status = 'draft'),
    COUNT(*) FILTER (WHERE status = 'issued'),
    COUNT(*) FILTER (WHERE status = 'partially_paid'),
    COUNT(*) FILTER (WHERE status = 'paid'),
    COUNT(*) FILTER (WHERE status = 'overdue')
  INTO v_draft, v_issued, v_partially_paid, v_paid, v_overdue
  FROM invoices WHERE business_id = v_business_id;

  SELECT COALESCE(SUM(amount_due), 0) INTO v_total_outstanding
  FROM invoices
  WHERE business_id = v_business_id
    AND status IN ('issued', 'partially_paid', 'overdue');

  RETURN jsonb_build_object(
    'draft', v_draft,
    'issued', v_issued,
    'partially_paid', v_partially_paid,
    'paid', v_paid,
    'overdue', v_overdue,
    'total_outstanding', v_total_outstanding
  );
END;
$$;

-- ============ INVENTORY ADJUSTMENT ============
CREATE OR REPLACE FUNCTION adjust_inventory(
  p_product_id uuid,
  p_new_quantity numeric,
  p_reason text DEFAULT 'Manual adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_old_quantity numeric(14,2);
  v_delta numeric(14,2);
  v_product_name text;
BEGIN
  v_business_id := get_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No business found for user';
  END IF;

  SELECT quantity_on_hand, name INTO v_old_quantity, v_product_name
  FROM products WHERE id = p_product_id AND business_id = v_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_delta := p_new_quantity - v_old_quantity;

  UPDATE products SET quantity_on_hand = p_new_quantity, updated_at = now()
    WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    business_id, product_id, movement_type, quantity_delta, notes, created_by
  ) VALUES (
    v_business_id, p_product_id, 'adjustment', v_delta, p_reason, auth.uid()
  );

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'product_name', v_product_name,
    'old_quantity', v_old_quantity,
    'new_quantity', p_new_quantity,
    'delta', v_delta
  );
END;
$$;

-- Grant execute on all functions to authenticated
GRANT EXECUTE ON FUNCTION get_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION create_sale TO authenticated;
GRANT EXECUTE ON FUNCTION create_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION create_expense TO authenticated;
GRANT EXECUTE ON FUNCTION record_customer_payment TO authenticated;
GRANT EXECUTE ON FUNCTION record_supplier_payment TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_supplier_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_comparison TO authenticated;
GRANT EXECUTE ON FUNCTION get_outstanding_receivables TO authenticated;
GRANT EXECUTE ON FUNCTION get_outstanding_payables TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoice_summary TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_inventory TO authenticated;


