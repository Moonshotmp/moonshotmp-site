import { describe, it, expect } from 'vitest';
import { geoFromContext } from '../netlify/functions/shared/geo.js';

describe('geoFromContext (Netlify request geo → lead payload)', () => {
    it('returns upper-cased two-letter subdivision and country codes', () => {
        const out = geoFromContext({ geo: { subdivision: { code: 'tx' }, country: { code: 'us' } } });
        expect(out).toEqual({ geo_state: 'TX', geo_country: 'US' });
    });
    it('returns empty strings when Netlify supplies no geo (local dev, missing context)', () => {
        expect(geoFromContext(undefined)).toEqual({ geo_state: '', geo_country: '' });
        expect(geoFromContext({})).toEqual({ geo_state: '', geo_country: '' });
        expect(geoFromContext({ geo: {} })).toEqual({ geo_state: '', geo_country: '' });
    });
    it('drops anything that is not exactly two letters', () => {
        const out = geoFromContext({ geo: { subdivision: { code: 'Texas' }, country: { code: 'U1' } } });
        expect(out).toEqual({ geo_state: '', geo_country: '' });
        expect(geoFromContext({ geo: { subdivision: { code: 42 } } }).geo_state).toBe('');
    });
});
