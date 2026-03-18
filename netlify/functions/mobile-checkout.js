import Stripe from 'stripe';
import { getSupabase } from './shared/supabase.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: CORS });

const PACKAGES = {
  basic: { priceId: 'price_1TC7bPFhpJeBhRGfuSwE4oJc', amount: 12500, name: 'Basic Hormone Panel' },
  comprehensive: { priceId: 'price_1TC7bRFhpJeBhRGfPcE2XYqf', amount: 28500, name: 'Comprehensive 60+ Panel' },
  elite: { priceId: 'price_1TC7bUFhpJeBhRGfzDVmwcJ1', amount: 40500, name: 'Elite Panel + DEXA' },
};

const EVENT_SLUG = 'coalition-apr-2026';

const VALID_SLOTS = new Set([
  '07:00','07:10','07:20','07:30','07:40','07:50',
  '08:00','08:10','08:20','08:30','08:40','08:50',
  '09:00','09:10','09:20','09:30','09:40','09:50',
  '10:00','10:05',
]);

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const secretKey = (process.env.STRIPE_MEDICAL_SECRET_KEY || '').trim();
  if (!secretKey) return json(500, { error: 'Stripe not configured' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const { slot_time, patient_first_name, patient_last_name, patient_email, patient_phone, patient_dob, patient_gender } = body;
  const pkg = (body.package || '').trim().toLowerCase();

  // Validate required fields
  if (!pkg || !PACKAGES[pkg]) return json(400, { error: 'Invalid package. Choose basic, comprehensive, or elite.' });
  if (!slot_time || !VALID_SLOTS.has(slot_time)) return json(400, { error: 'Invalid time slot.' });
  if (!patient_first_name?.trim()) return json(400, { error: 'First name is required' });
  if (!patient_last_name?.trim()) return json(400, { error: 'Last name is required' });
  if (!patient_email?.trim() || !patient_email.includes('@')) return json(400, { error: 'Valid email is required' });

  const pkgInfo = PACKAGES[pkg];
  const siteUrl = (process.env.SITE_URL || '').trim() || 'https://moonshotmp.com';

  try {
    const supabase = getSupabase();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Check existing slot
    const { data: existing } = await supabase
      .from('mobile_event_bookings')
      .select('id, status, created_at')
      .eq('event_slug', EVENT_SLUG)
      .eq('slot_time', slot_time)
      .single();

    if (existing) {
      if (existing.status === 'paid') {
        return json(409, { error: 'This time slot has been booked.' });
      }
      if (existing.status === 'held' && existing.created_at > thirtyMinAgo) {
        return json(409, { error: 'This slot is being booked by someone else. Try a different time.' });
      }
      // Stale hold or expired/failed — delete it
      await supabase.from('mobile_event_bookings').delete().eq('id', existing.id);
    }

    // Insert held row (UNIQUE constraint prevents race condition)
    const { data: booking, error: insertErr } = await supabase
      .from('mobile_event_bookings')
      .insert({
        event_slug: EVENT_SLUG,
        slot_time,
        package: pkg,
        price_id: pkgInfo.priceId,
        amount_cents: pkgInfo.amount,
        patient_first_name: patient_first_name.trim(),
        patient_last_name: patient_last_name.trim(),
        patient_email: patient_email.trim().toLowerCase(),
        patient_phone: (patient_phone || '').trim() || null,
        patient_dob: (patient_dob || '').trim() || null,
        patient_gender: (patient_gender || '').trim() || null,
        status: 'held',
      })
      .select()
      .single();

    if (insertErr) {
      // UNIQUE constraint violation = someone else grabbed it
      if (insertErr.code === '23505') {
        return json(409, { error: 'This slot was just taken. Please choose another time.' });
      }
      console.error('[mobile-checkout] Insert error:', insertErr);
      return json(500, { error: 'Failed to reserve slot' });
    }

    // Create Stripe Checkout Session
    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: pkgInfo.priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${siteUrl}/medical/mobile-blood-draw/coalition/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/medical/mobile-blood-draw/coalition/#packages`,
      customer_email: patient_email.trim().toLowerCase(),
      expires_at: Math.floor(Date.now() / 1000) + 2700, // 45 min — buffer over Stripe's 30-min minimum
      metadata: {
        event_slug: EVENT_SLUG,
        slot_time,
        package: pkg,
        patient_first_name: patient_first_name.trim(),
        patient_last_name: patient_last_name.trim(),
        patient_email: patient_email.trim().toLowerCase(),
        patient_phone: (patient_phone || '').trim(),
        patient_dob: (patient_dob || '').trim(),
        patient_gender: (patient_gender || '').trim(),
      },
      payment_intent_data: {
        metadata: {
          event_slug: EVENT_SLUG,
          slot_time,
          package: pkg,
          patient_email: patient_email.trim().toLowerCase(),
        },
      },
    });

    // Update booking with Stripe session ID
    await supabase
      .from('mobile_event_bookings')
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    return json(200, { url: session.url });
  } catch (err) {
    console.error('[mobile-checkout] Error:', err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
};
