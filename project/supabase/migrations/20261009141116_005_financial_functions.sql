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
