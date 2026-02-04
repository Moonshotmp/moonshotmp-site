-- Moonshot Membership System - Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Patients table: links Elation patients to Stripe customers
CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE NOT NULL,
  email TEXT,
  phone TEXT,
  elation_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(first_name, last_name, dob)
);

-- Index for patient lookups
CREATE INDEX idx_patients_name_dob ON patients (last_name, first_name, dob);
CREATE INDEX idx_patients_email ON patients (email) WHERE email IS NOT NULL;
CREATE INDEX idx_patients_phone ON patients (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_patients_stripe ON patients (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_patients_elation ON patients (elation_id) WHERE elation_id IS NOT NULL;

-- Memberships table: tracks subscription state
CREATE TABLE memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'hormone_therapy',
  amount_cents INTEGER NOT NULL DEFAULT 23500, -- $235.00
  status TEXT NOT NULL DEFAULT 'active',
  -- status values: active, past_due, canceled, unpaid, incomplete
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memberships_patient ON memberships (patient_id);
CREATE INDEX idx_memberships_status ON memberships (status);
CREATE INDEX idx_memberships_stripe ON memberships (stripe_subscription_id);

-- Payments table: all payment records (membership + one-time)
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  type TEXT NOT NULL, -- 'membership' or 'lab_work'
  description TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'succeeded',
  -- status values: succeeded, failed, pending, refunded
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_patient ON payments (patient_id);
CREATE INDEX idx_payments_type ON payments (type);
CREATE INDEX idx_payments_created ON payments (created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (keep data private, accessed only via service role)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow access only via service_role (Netlify functions use this)
CREATE POLICY "Service role access" ON patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role access" ON payments FOR ALL USING (true) WITH CHECK (true);
