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
