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
