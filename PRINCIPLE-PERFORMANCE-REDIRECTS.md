# Principle Performance Health — Domain Redirect Audit & Status

**Date:** 2026-03-03
**Domain:** principleperformancehealth.com
**Owner:** Tom Kashul (confirmed — domain is under your control)

---

## Current State: REDIRECTS ARE LIVE

The domain `principleperformancehealth.com` is already 301-redirecting to `https://moonshotmp.com/principle-landing/`.

### What's Working

| Component | Status | Notes |
|-----------|--------|-------|
| Root domain redirect | LIVE | `principleperformancehealth.com` → `moonshotmp.com/principle-landing/` (301) |
| Sub-page redirects | PARTIALLY WORKING | All sub-pages (e.g., `/services/chiropractic-services/`, `/what-we-treat/back-pain-relief-sciatica-pain-relief/`) currently 301 to the landing page root |
| Landing page on moonshotmp.com | LIVE | `/principle-landing/` exists with full content, schema, testimonials |
| `.htaccess` redirect map | PREPARED | Located at `principle-landing/.htaccess` — ready for Apache deployment |
| `_redirects` file | PREPARED | Located at `principle-landing/_redirects` — ready for Netlify deployment |
| Sitemap inclusion | YES | `/principle-landing/` is in sitemap.xml |

### What's NOT Working (Gap)

The `.htaccess` and `_redirects` files contain granular per-page redirects (e.g., `/services/chiropractic-services/` → `moonshotmp.com/rehab/chiropractic/`), but **these files are sitting inside the moonshotmp.com repo**, not deployed on the principleperformancehealth.com hosting. The actual domain-level redirect is a blanket 301 — every path on principleperformancehealth.com redirects to `moonshotmp.com/principle-landing/` regardless of the original URL path.

**This is a missed SEO opportunity.** Google still indexes 10+ distinct Principle Performance pages. A blanket redirect sends all link equity to one landing page instead of distributing it to the most relevant Moonshot pages.

---

## Google Index Status (still indexed as of 2026-03-03)

Google still shows these principleperformancehealth.com pages in search results:

| PP URL | Still Indexed | Current Redirect Target | Recommended Target |
|--------|--------------|------------------------|-------------------|
| `/` (homepage) | Yes | `/principle-landing/` | `/principle-landing/` (correct) |
| `/services/` | Yes | `/principle-landing/` | `/rehab/` |
| `/services/shockwave-therapy/` | Yes | `/principle-landing/` | `/learn/shockwave-therapy/` |
| `/services/spinal-manipulation/` | Yes | `/principle-landing/` | `/rehab/chiropractic/` |
| `/services/massage-therapy/` | Yes | `/principle-landing/` | `/rehab/` |
| `/services/sports-rehab/` | Yes | `/principle-landing/` | `/rehab/physical-rehab/` |
| `/services/fitness-training/` | Yes | `/principle-landing/` | `/rehab/` |
| `/what-we-treat/neck-pain/` | Yes | `/principle-landing/` | `/rehab/chiropractic/` |
| `/what-we-treat/joint-pain/` | Yes | `/principle-landing/` | `/rehab/` |
| `/what-we-treat/shoulder-pain/` | Yes | `/principle-landing/` | `/rehab/` |
| `/what-we-treat/hip-and-knee-pain/` | Yes | `/principle-landing/` | `/rehab/` |
| `/staff/` | Yes | `/principle-landing/` | `/about/` |
| `/insurance/` | Yes | `/principle-landing/` | `/rehab/` |
| `/chiropractor-near-me-northwest-chicago/` | Yes | `/principle-landing/` | `/rehab/chiropractic/` |

---

## Full 301 Redirect Map

These are the page-level redirects that should replace the blanket redirect. All are 301 (permanent).

### Services Pages
| From (principleperformancehealth.com) | To (moonshotmp.com) |
|---------------------------------------|---------------------|
| `/services/` | `/rehab/` |
| `/services/chiropractic-services/` | `/rehab/chiropractic/` |
| `/services/dry-needling/` | `/learn/dry-needling/` |
| `/services/shockwave-therapy/` | `/learn/shockwave-therapy/` |
| `/services/spinal-manipulation/` | `/rehab/chiropractic/` |
| `/services/sports-rehab/` | `/rehab/physical-rehab/` |
| `/services/massage-therapy/` | `/rehab/` |
| `/services/manual-therapy/` | `/rehab/` |
| `/services/nutrition-counseling/` | `/medical/` |
| `/services/fitness-training/` | `/rehab/` |
| `/services/iastm/` | `/rehab/` |
| `/services/graston-technique/` | `/rehab/` |
| `/services/pre-post-surgery/` | `/rehab/physical-rehab/` |
| `/services/lymphatic-drainage-massage-in-illinois/` | `/rehab/` |

### What We Treat Pages
| From (principleperformancehealth.com) | To (moonshotmp.com) |
|---------------------------------------|---------------------|
| `/what-we-treat/` | `/rehab/` |
| `/what-we-treat/back-pain-relief-sciatica-pain-relief/` | `/rehab/chiropractic/` |
| `/what-we-treat/neck-pain/` | `/rehab/chiropractic/` |
| `/what-we-treat/shoulder-pain/` | `/rehab/` |
| `/what-we-treat/hip-and-knee-pain/` | `/rehab/` |
| `/what-we-treat/headaches/` | `/rehab/chiropractic/` |
| `/what-we-treat/sports-injuries/` | `/rehab/physical-rehab/` |
| `/what-we-treat/plantar-fasciitis/` | `/learn/shockwave-therapy/` |
| `/what-we-treat/running-injuries/` | `/rehab/physical-rehab/` |
| `/what-we-treat/tendinitis/` | `/learn/shockwave-therapy/` |
| `/what-we-treat/chronic-pain/` | `/learn/trigger-point-injections/` |
| `/what-we-treat/joint-pain/` | `/rehab/` |
| `/what-we-treat/nerve-pain/` | `/rehab/chiropractic/` |
| `/what-we-treat/arthritis/` | `/rehab/` |
| `/what-we-treat/fibromyalgia/` | `/learn/trigger-point-injections/` |
| `/what-we-treat/foot-or-ankle-pain/` | `/learn/shockwave-therapy/` |
| `/what-we-treat/elbow-wrist-and-hand-pain/` | `/rehab/` |
| `/what-we-treat/golfing-injuries/` | `/rehab/physical-rehab/` |
| `/what-we-treat/bladder-bowel-dysfunction/` | `/rehab/` |
| `/what-we-treat/common-conditions-treated/` | `/rehab/` |

### Location/Geo Pages
| From (principleperformancehealth.com) | To (moonshotmp.com) |
|---------------------------------------|---------------------|
| `/chiropractor-near-me-northwest-chicago/` | `/rehab/chiropractic/` |
| `/chiropractor-in-niles-il/` | `/rehab/chiropractic/` |
| `/chiropractor-in-des-plaines-il/` | `/rehab/chiropractic/` |
| `/chiropractor-in-edison-park-il/` | `/rehab/chiropractic/` |
| `/chiropractor-in-norridge-il/` | `/rehab/chiropractic/` |
| `/neck-pain-chiropractor-chicago/` | `/rehab/chiropractic/` |

### Other Pages
| From (principleperformancehealth.com) | To (moonshotmp.com) |
|---------------------------------------|---------------------|
| `/what-is-mdt/` | `/rehab/chiropractic/` |
| `/treatment-approach/` | `/rehab/` |
| `/staff/dr-michael-jeremy-gontarek/` | `/about/` |
| `/staff/` | `/about/` |
| `/testimonial/` | `/principle-landing/` |
| `/faq/` | `/rehab/` |
| `/contact-us/` | `/contact/` |
| `/request-an-appointment/` | `/booking/rehab/` |
| `/insurance/` | `/rehab/` |

### Catch-All
| From | To |
|------|-----|
| `/*` (anything not matched above) | `/principle-landing/` |

---

## Implementation Options

### Option A: Netlify (Recommended if PP domain is on Netlify)

If principleperformancehealth.com is hosted on Netlify (or you can point it there):

1. Create a new Netlify site for `principleperformancehealth.com`
2. Add a `_redirects` file at the root with the granular redirects (already prepared at `principle-landing/_redirects`)
3. Add a catch-all at the bottom: `/* https://moonshotmp.com/principle-landing/ 301`
4. Add `principleperformancehealth.com` as a custom domain on the Netlify site
5. Point DNS to Netlify's load balancer

The `_redirects` file is already written and ready at:
`/Users/tomkashul/Desktop/moonshotmp-site/principle-landing/_redirects`

### Option B: Cloudflare Page Rules / Redirect Rules

If the domain's DNS is on Cloudflare:

1. Create a Cloudflare Redirect Rule (bulk redirects) with the full map
2. Each rule: Source URL → Destination URL, Status 301, Preserve query string
3. Add a final catch-all rule: `principleperformancehealth.com/*` → `moonshotmp.com/principle-landing/`
4. Cloudflare handles this at the edge — no hosting needed

### Option C: DNS-Level (Current — Simplest but Least Granular)

The current setup appears to be a DNS-level or hosting-level blanket redirect. This works but:
- All pages go to one destination (lost SEO granularity)
- No path-specific mapping
- Good enough for brand transition, suboptimal for SEO equity transfer

**Recommendation:** Option A or B for granular redirects. The redirect map is already written.

---

## Keywords This Domain Captures

Based on Google's index, principleperformancehealth.com still ranks or appears for:

- "chiropractor park ridge il"
- "chiropractor near me northwest chicago"
- "shockwave therapy park ridge"
- "spinal manipulation park ridge"
- "neck pain park ridge"
- "joint pain park ridge"
- "sports rehab park ridge"
- "dry needling park ridge" (likely)
- "back pain chiropractor park ridge" (likely)

These are all local rehab/chiro keywords that should flow to your corresponding moonshotmp.com pages via granular 301s rather than all dumping into one landing page.

---

## Issues Found on moonshotmp.com (Action Items)

### 1. Stale Email References
Two pages still show `support@principleperformancehealth.com` as a contact email:

- **`/about/index.html`** (line 388) — Rehab contact section
- **`/contact/index.html`** (line 105) — Main contact page

**Action:** Update both to `hello@moonshotmp.com` or whatever the current rehab email should be. Having a dead brand's email on your contact page hurts trust.

### 2. Google Maps Link Uses Old Brand Name
- **`/rehab/index.html`** (line 390) — "See All Reviews on Google" links to `google.com/maps/place/Principle+Performance+Health/`

**Action:** Update to use the Moonshot Medical Google Maps listing URL. If the Google Business Profile has been migrated to "Moonshot Medical and Performance," update this link accordingly.

### 3. Copyright Year
- **`/principle-landing/index.html`** (line 562) — Shows "2025" copyright

**Action:** Update to 2026.

### 4. Landing Page Could Be Stronger
The `/principle-landing/` page is well-built but could add:
- A clear "What changed / What didn't change" comparison table for returning patients
- Internal links to specific learn articles (dry needling, shockwave, etc.) for SEO interlinking
- A FAQ section addressing common transition questions ("Do I need to re-register?", "Is my treatment history available?", etc.)

---

## Summary

| Item | Status | Priority |
|------|--------|----------|
| Domain redirect (blanket) | LIVE | -- |
| Granular per-page redirects | PREPARED but NOT DEPLOYED | HIGH |
| Landing page on moonshotmp.com | LIVE and solid | -- |
| Stale PP email on contact/about | NEEDS FIX | MEDIUM |
| Google Maps link uses old name | NEEDS FIX | LOW |
| Copyright year on landing page | NEEDS FIX | LOW |
| Sitemap inclusion | DONE | -- |
| Schema markup (MedicalBusiness) | DONE (includes alternateName) | -- |
| sameAs reference in homepage schema | DONE | -- |

**Bottom line:** The domain is yours and already redirecting. The high-leverage move is deploying the granular redirect map (already written) so Google transfers page-level authority to the right Moonshot pages instead of funneling everything to one landing page. The secondary move is cleaning up the stale PP email addresses on the about and contact pages.
