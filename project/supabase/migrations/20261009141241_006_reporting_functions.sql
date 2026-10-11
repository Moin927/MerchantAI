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
