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
