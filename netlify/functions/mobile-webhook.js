import Stripe from 'stripe';
import { getSupabase } from './shared/supabase.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secretKey = (process.env.STRIPE_MEDICAL_SECRET_KEY || '').trim();
  const webhookSecret = (process.env.STRIPE_MEDICAL_WEBHOOK_SECRET || '').trim();

  if (!secretKey) {
    console.error('[mobile-webhook] Missing STRIPE_MEDICAL_SECRET_KEY');
    return new Response('Server error', { status: 500 });
  }

  const stripe = new Stripe(secretKey);

  let stripeEvent;
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  // Verify webhook signature
  if (webhookSecret && sig) {
    try {
      stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error('[mobile-webhook] Signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  } else {
    try {
      stripeEvent = JSON.parse(body);
      console.log('[mobile-webhook] WARNING: No signature verification');
    } catch (err) {
      return new Response('Invalid JSON', { status: 400 });
    }
  }

  console.log('[mobile-webhook] Received event:', stripeEvent.type);

  const supabase = getSupabase();

  // ── checkout.session.completed ────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const meta = session.metadata || {};

    // Only process if this is a mobile event booking
    if (!meta.event_slug) {
      console.log('[mobile-webhook] No event_slug in metadata, skipping');
      return new Response('OK', { status: 200 });
    }

    // Update Supabase: mark as paid
    try {
      const { error: updateErr } = await supabase
        .from('mobile_event_bookings')
        .update({
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent || null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_checkout_session_id', session.id);

      if (updateErr) {
        console.error('[mobile-webhook] Supabase update error:', updateErr);
      } else {
        console.log('[mobile-webhook] Booking marked paid for session:', session.id);
      }
    } catch (err) {
      console.error('[mobile-webhook] Supabase update failed:', err);
    }

    // Sync to clinic API (non-blocking — always return 200 to Stripe)
    try {
      const clinicApi = process.env.CLINIC_API_BASE || 'https://api.moonshotclinic.com';
      const webhookKey = process.env.CLINIC_LEAD_WEBHOOK_KEY || '';

      const clinicRes = await fetch(`${clinicApi}/api/webhooks/mobile-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': 'moonshot',
          'X-Webhook-Key': webhookKey,
        },
        body: JSON.stringify({
          patient_first_name: meta.patient_first_name,
          patient_last_name: meta.patient_last_name,
          patient_email: meta.patient_email,
          patient_phone: meta.patient_phone,
          patient_dob: meta.patient_dob,
          patient_gender: meta.patient_gender,
          package: meta.package,
          slot_time: meta.slot_time,
          event_date: '2026-04-04',
          location_address: '2051 West Carroll Ave, Chicago, IL 60612',
          location_name: 'Coalition Strength & Conditioning',
          stripe_payment_intent_id: session.payment_intent,
          stripe_checkout_session_id: session.id,
          amount_cents: session.amount_total,
        }),
      });

      if (clinicRes.ok) {
        const clinicData = await clinicRes.json().catch(() => ({}));
        console.log('[mobile-webhook] Clinic sync success:', clinicData);

        // Update booking with clinic IDs if returned
        if (clinicData.appointment_id || clinicData.patient_id) {
          await supabase
            .from('mobile_event_bookings')
            .update({
              clinic_appointment_id: clinicData.appointment_id || null,
              clinic_patient_id: clinicData.patient_id || null,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_checkout_session_id', session.id);
        }
      } else {
        console.error('[mobile-webhook] Clinic sync failed:', clinicRes.status, await clinicRes.text().catch(() => ''));
      }
    } catch (err) {
      console.error('[mobile-webhook] Clinic sync error:', err.message);
      // Don't fail the webhook — Stripe needs a 200
    }
  }

  // ── checkout.session.expired ──────────────────────────────────
  if (stripeEvent.type === 'checkout.session.expired') {
    const session = stripeEvent.data.object;

    try {
      const { error: updateErr } = await supabase
        .from('mobile_event_bookings')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_checkout_session_id', session.id);

      if (updateErr) {
        console.error('[mobile-webhook] Expire update error:', updateErr);
      } else {
        console.log('[mobile-webhook] Booking expired for session:', session.id);
      }
    } catch (err) {
      console.error('[mobile-webhook] Expire update failed:', err);
    }
  }

  // Always return 200 to Stripe
  return new Response('OK', { status: 200 });
};
