// Request geography from Netlify's edge (Functions 2.0 `context.geo`).
// Used to record which state a lead is in even when a form never asks.
// Values are validated to two letters so nothing attacker-shaped reaches
// the clinic webhook. Empty strings when Netlify supplies no geo (local dev).
export function geoFromContext(context) {
  const geo = context && context.geo ? context.geo : {};
  const two = (v) => (typeof v === 'string' && /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : '');
  return {
    geo_state: two(geo.subdivision && geo.subdivision.code),
    geo_country: two(geo.country && geo.country.code),
  };
}
