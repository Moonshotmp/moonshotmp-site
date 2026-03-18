import { getSupabase } from './shared/supabase.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: CORS });

// All 20 slots for Coalition Apr 2026
const ALL_SLOTS = [
  '07:00', '07:10', '07:20', '07:30', '07:40', '07:50',
  '08:00', '08:10', '08:20', '08:30', '08:40', '08:50',
  '09:00', '09:10', '09:20', '09:30', '09:40', '09:50',
  '10:00', '10:05',
];

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });

  const url = new URL(req.url);
  const eventSlug = url.searchParams.get('event_slug');
  if (!eventSlug) return json(400, { error: 'event_slug required' });

  try {
    const supabase = getSupabase();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Get booked slots: paid OR recently held
    const { data: booked, error } = await supabase
      .from('mobile_event_bookings')
      .select('slot_time, status, created_at')
      .eq('event_slug', eventSlug)
      .or(`status.eq.paid,and(status.eq.held,created_at.gt.${thirtyMinAgo})`);

    if (error) {
      console.error('[mobile-slots] Supabase error:', error);
      return json(500, { error: 'Failed to load slots' });
    }

    const takenTimes = new Set((booked || []).map(r => r.slot_time));

    const slots = ALL_SLOTS.map(time => ({
      time,
      display: formatTime(time),
      available: !takenTimes.has(time),
    }));

    return json(200, {
      event_slug: eventSlug,
      event_date: '2026-04-04',
      total_slots: ALL_SLOTS.length,
      available_count: slots.filter(s => s.available).length,
      slots,
    });
  } catch (err) {
    console.error('[mobile-slots] Error:', err);
    return json(500, { error: 'Internal server error' });
  }
};
