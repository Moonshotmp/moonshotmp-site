-- Mobile event bookings — slot reservation + payment tracking
CREATE TABLE IF NOT EXISTS mobile_event_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_slug TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  package TEXT NOT NULL,
  price_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  patient_first_name TEXT NOT NULL,
  patient_last_name TEXT NOT NULL,
  patient_email TEXT NOT NULL,
  patient_phone TEXT,
  patient_dob TEXT,
  patient_gender TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'held',
  clinic_appointment_id TEXT,
  clinic_patient_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_slug, slot_time)
);

CREATE INDEX IF NOT EXISTS idx_meb_event ON mobile_event_bookings(event_slug);
CREATE INDEX IF NOT EXISTS idx_meb_status ON mobile_event_bookings(event_slug, status);
CREATE INDEX IF NOT EXISTS idx_meb_session ON mobile_event_bookings(stripe_checkout_session_id);
