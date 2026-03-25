// RAG Chat API — Moonshot Medical AI Assistant (v2)
// POST { message: string, history?: [{ role, content }] }
// Returns { reply: string, sources: [{ title, url }] }

import { getSupabase } from "./shared/supabase.js";

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini";
const REWRITE_MODEL = "gpt-4o-mini";
const MAX_HISTORY = 10;
const LOW_SIMILARITY_THRESHOLD = 0.3;
const HEDGING_PATTERN =
  /i('m| am) not sure|don't have.*information|contact (the|our) (clinic|team)/i;
const RATE_LIMIT_MAX = 20; // max requests per window
const RATE_LIMIT_WINDOW = 600; // window in seconds (10 minutes)

const SYSTEM_PROMPT = `You are the Moonshot Medical and Performance AI assistant. You help prospective and current patients learn about the clinic's services, pricing, team, and programs.

CRITICAL — Source of Truth Hierarchy:
- The "Base Knowledge" section below is the AUTHORITATIVE source of truth. It defines what the clinic offers, current pricing, and current services.
- "Additional relevant content" chunks are supplementary context from website articles. They may contain educational or historical information about services the clinic does NOT offer.
- If there is ANY conflict between Base Knowledge and a retrieved chunk, Base Knowledge wins. Always.
- ONLY list services and products that appear in Base Knowledge as current offerings. If something is described in a retrieved chunk but NOT listed in Base Knowledge as offered, do NOT tell the user we offer it.

Specific notes:
- Our peptide offerings include: BPC-157 ($250/mo), TB-500 ($250/mo), GHK-Cu ($175/mo), Wolverine Blend - BPC-157+TB-500 ($375/mo), Glow Stack - GHK-Cu+BPC-157+TB-500 ($400/mo), Sermorelin ($250/mo), PT-141 ($250/mo). All sourced from licensed 503A compounding pharmacies.
- Peptide protocol bundles (all except PT-141): 3-month protocols save 15%, 6-month protocols save 20% (includes built-in cycle-off month). BPC-157: 3-mo $635, 6-mo $1,200. TB-500: 3-mo $635, 6-mo $1,200. Wolverine Blend: 3-mo $955, 6-mo $1,800. GHK-Cu: 3-mo $445, 6-mo $840. Glow Stack: 3-mo $1,020, 6-mo $1,920. Sermorelin: 3-mo $635, 6-mo $1,200. PT-141 is as-needed only — no protocol bundles.

Rules:
- Answer questions using ONLY the provided context. Do not make up information.
- If you're unsure or the answer isn't in the context, say so honestly and suggest contacting the clinic at (224) 435-4280 or hello@moonshotmp.com.
- Be friendly, direct, and helpful. Match the clinic's tone: confident, no-BS, evidence-based.
- Keep answers concise — 2-4 sentences for simple questions, more for detailed clinical questions.
- When discussing pricing, always mention exact prices from the Base Knowledge.
- Do NOT include any links or URLs in your response EXCEPT the booking link. The chat interface will automatically display source links below your answer. Never generate markdown links.
- When someone asks how to book, schedule, or make an appointment, ALWAYS tell them to book online at moonshotmp.com/booking/ — this is the primary booking method. Also mention they can call (224) 435-4280.
- Always end clinical/medical answers with: "This is general information — for personalized guidance, book a consultation at moonshotmp.com/booking."
- Never provide specific medical diagnoses or treatment recommendations for the user's personal health.
- If asked about topics unrelated to Moonshot Medical, politely redirect to clinic-related topics.`;

// Curated source of truth — the authoritative knowledge base for every query.
// This is NOT auto-generated. Edit manually when services/pricing change.
const BASE_CONTEXT = `# Moonshot Medical and Performance — Source of Truth

## Quick Summary
Moonshot Medical and Performance is a performance medicine clinic combining medical optimization with physical rehabilitation in Park Ridge, IL. We focus on taking people from "normal" to optimal — not waiting until something is broken to act. Data-driven, proactive, and evidence-based. 5.0 stars on Google with 141 reviews.

## Location & Contact
- Address: 542 Busse Hwy, Park Ridge, IL 60068
- Phone: (224) 435-4280
- Email: hello@moonshotmp.com
- Website: https://moonshotmp.com
- Book Online: https://moonshotmp.com/booking/ (primary way to schedule any appointment)
- Book Medical: https://moonshotmp.com/booking/medical/
- Book Rehab: https://moonshotmp.com/booking/rehab/

## Hours
- Monday: 7:00am-4:00pm
- Tuesday: 11:00am-6:00pm
- Wednesday: 9:00am-7:00pm
- Thursday: 11:00am-6:00pm
- Friday: 7:00am-3:00pm
- Saturday: 8:00am-2:00pm
- Sunday: Closed

## Our Team

### Missy Zammichieli, DNP, APRN, FNP-BC — Medical Director
- Board-Certified Family Nurse Practitioner
- Doctor of Nursing Practice (DNP)
- Leads all medical optimization services: hormone therapy, weight loss, blood panels, DEXA scans, peptides
- Medically reviews all educational content on the site
- Philosophy: "We don't guess. We test, we track, and we optimize based on your data."

### Dr. Michael Gontarek, DC, MSc, DACBN — Partner, Physical Medicine
- Doctor of Chiropractic (DC)
- Master of Science in Clinical Nutrition (MSc)
- Diplomate of the American Clinical Board of Nutrition (DACBN)
- McKenzie Method Certified
- Leads all rehabilitation services: chiropractic, dry needling, trigger point injections, shockwave therapy
- Also provides nutritional counseling

### Supporting Team
- Sarah (RN, MSN): Registered Nurse supporting medical services
- Melissa: Medical Assistant, supports labs and DEXA scans
- Sarah: Performance Specialist, works with rehab patients on movement restoration and strength programming
- Maria: Patient Experience & Brand Lead

---

## Medical Services

### Comprehensive Blood Panel — $285
60+ biomarkers including:
- Hormones: Total testosterone, free testosterone, estradiol, progesterone, DHEA-S, thyroid panel (TSH, free T3, free T4) with antibodies
- Metabolic: Fasting glucose, HbA1c, insulin, lipid panel, ApoB, Lp(a)
- Inflammation: CRP, homocysteine
- Nutrients: Vitamin D, B12, ferritin, iron panel, magnesium
- Organ function: Complete metabolic panel, liver enzymes, kidney function
- Blood cells: Complete blood count with differential

Fasting: Minimum 8 hours (ideal 10-12). Water and black coffee allowed. Results in 3-5 business days.

### DEXA Body Composition Scan — $150
Medical-grade body composition analysis using dual-energy X-ray absorptiometry:
- Total body fat percentage and distribution
- Lean muscle mass by region (arms, legs, trunk)
- Bone mineral density (osteoporosis screening)
- Visceral adipose tissue (VAT)
- Android/gynoid fat ratio

Equipment: Hologic Horizon scanner (gold standard). Scan takes under 3 minutes. Supports patients up to 500 lbs. More accurate than InBody, Bod Pod, or calipers.

Prep: Avoid eating/drinking 2 hours before. Wear comfortable clothing without metal. Results same day.

### Performance Baseline Bundle — $405 (save $30)
DEXA scan + comprehensive blood panel together. Best starting point for optimization.

### Men's Hormone Optimization — $235/month
For men experiencing low energy, decreased libido, brain fog, mood changes, difficulty building muscle, increased body fat, poor sleep.

Includes: Ongoing medical oversight, personalized protocol, 2 DEXA scans/year, comprehensive labs every 6 months, 1 vitamin shot/month, dosing adjustments, provider access.

Treatment options: Testosterone cypionate injections, enclomiphene (fertility-preserving), thyroid optimization.

### Women's Hormone Optimization — $285/month
For women experiencing perimenopause/menopause symptoms, hot flashes, sleep disturbances, mood changes, low libido, weight gain, bone density concerns.

Includes: Ongoing medical oversight, personalized protocol, 2 DEXA scans/year, comprehensive labs every 6 months, 1 vitamin shot/month, dosing adjustments, provider access.

Treatment options: Estradiol (patch, cream, or pellets), progesterone, testosterone, DHEA, thyroid optimization. All bioidentical hormones — molecularly identical to what the body produces.

### Weight Loss Program (GLP-1) — $405/month
Medications: Semaglutide (same active ingredient as Ozempic/Wegovy) or tirzepatide (same as Mounjaro/Zepbound).

Includes: GLP-1 medication, medical oversight, DEXA tracking (fat loss vs muscle loss), lab monitoring, dosing adjustments, nutrition guidance.

Average weight loss: 15-20% of body weight over 12-18 months.

### Medical Oversight Only — $150/month
For patients whose insurance covers their medication. Includes medical oversight and monitoring, prescription sent to your pharmacy, 2 DEXA scans per year, comprehensive blood panels every 6 months, and 1 vitamin shot per month.

### Prescription + Oversight Program — $105/month
For patients whose insurance covers GLP-1 or hormone medications. We write the prescription, provide medical oversight, lab work, dosing guidance, and provider access.

### Peptides & Add-On Therapies
All peptides sourced from licensed 503A compounding pharmacies with medical oversight.

Individual Peptides:
- BPC-157 — $250/month: Body Protection Compound. Promotes healing of tendons, ligaments, gut, and muscle. Works by upregulating growth factors and promoting angiogenesis. Most studied healing peptide. Available via 503A pharmacy.
- TB-500 — $250/month: Thymosin beta-4. Accelerates tissue repair by upregulating actin for cell migration. Reduces inflammation. Often combined with BPC-157.
- GHK-Cu — $175/month: Copper peptide. Stimulates collagen synthesis, skin rejuvenation, hair growth, wound healing. Naturally occurring peptide that declines with age. Most affordable peptide option.
- Sermorelin — $250/month: Growth hormone releasing hormone analog. Stimulates natural GH production. Benefits: improved sleep, recovery, body composition, energy. Previously FDA-approved (Geref, 1997).
- PT-141 — $250/month: Bremelanotide. Works on the central nervous system to increase sexual desire and arousal. Works for both men and women. FDA-approved as Vyleesi (2019). Different mechanism than Viagra/Cialis.

Peptide Stacks:
- Wolverine Blend — $375/month: BPC-157 + TB-500 combined in one injection. Dual-pathway healing. Saves $125/mo vs purchasing separately ($500).
- Glow Stack — $400/month: GHK-Cu + BPC-157 + TB-500 triple-peptide protocol. Skin rejuvenation + tissue healing + recovery. Saves $275/mo vs purchasing all three separately ($675).

Protocol Bundles (save 15-20%):
All peptides except PT-141 are available in multi-month protocols. 3-month protocols save 15%. 6-month protocols save 20% and include a built-in cycle-off month.
- BPC-157: 3-mo $635, 6-mo $1,200
- TB-500: 3-mo $635, 6-mo $1,200
- Wolverine Blend: 3-mo $955, 6-mo $1,800
- GHK-Cu: 3-mo $445, 6-mo $840
- Glow Stack: 3-mo $1,020, 6-mo $1,920
- Sermorelin: 3-mo $635, 6-mo $1,200
- PT-141: as-needed only, no protocol bundles

Important peptide notes:
- All peptides require an initial consultation before prescribing
- Peptides can be standalone — they do NOT require being on a hormone program
- Medical oversight, personalized dosing, and injection training included
- Insurance does not cover peptide therapy — cash-pay service
- BPC-157 and TB-500 are available through 503A compounding pharmacies (patient-specific prescriptions). The FDA's 2024 decision removed them from 503B bulk manufacturing, but 503A operates under a different regulatory framework.

### Vitamin & Nutrient Injections
- NAD+: $60/shot (cellular energy & longevity)
- Vitamin C: $30-60/shot (immune support & antioxidant)
- B12: $30/shot (energy & nervous system)
- MIC B: $30/shot (fat metabolism & energy)
- Glutathione: $30/shot (master antioxidant & detox)

Hormone optimization and weight loss members get 1 complimentary injection per month.

### Add-On Medications
- HCG: $350/month (maintains testicular function during TRT, fertility preservation)
- Enclomiphene: $200-208/month (stimulates natural testosterone production, fertility-preserving)
- Daily Tadalafil: $70/month (2.5-5mg daily for blood flow, prostate health, endothelial function, mild BP reduction. Often combined with TRT. NEVER combine with nitrates.)

---

## Rehab Services

Insurance accepted for rehab services. HSA/FSA accepted.

### Chiropractic Care
Evidence-based chiropractic with Dr. Michael Gontarek, McKenzie Method certified. Treats back pain, neck pain, joint pain, sports injuries. Goal is to fix the problem and teach self-management — most patients improve within 6-8 visits. No "maintenance adjustment" plans. Initial visit: 45-60 minutes. No referral needed in Illinois.

### Physical Rehabilitation
Movement restoration and strength-based rehabilitation. For post-injury recovery, chronic pain, and performance optimization.

### Trigger Point Injections
Targeted injections for chronic muscle pain — neck/shoulder tension, headaches, lower back spasms, fibromyalgia. Common patterns: upper trap (headaches), infraspinatus (shoulder/arm pain), piriformis (sciatica-like symptoms), QL (lower back/hip pain).

### Dry Needling
Thin filament needles targeting muscle trigger points. Based on modern neuroscience (not acupuncture). Effective for chronic tension, myofascial pain, headaches, tennis/golf elbow, TMJ, shoulder/arm pain, back pain, hip pain, knee pain, plantar fasciitis. Soreness for 24-48 hours after treatment is normal.

### Shockwave Therapy (ESWT)
Acoustic wave therapy for chronic tendon injuries. 3-6 sessions, 1 week apart, 10-15 minutes each. 70-90% success rate for appropriate candidates. Full effects over 6-12 weeks. Effective for plantar fasciitis, Achilles tendinopathy, tennis/golf elbow, patellar tendinopathy, calcific tendinitis, hip bursitis, rotator cuff issues.

### IASTM & Soft Tissue Mobilization
Instrument-assisted soft tissue mobilization to break up scar tissue, improve tissue quality, and restore range of motion.

---

## FAQ

**Insurance:** Medical optimization services are cash-pay only. Rehab services accept insurance. HSA/FSA accepted for most services.

**What makes Moonshot different?** We test 60+ biomarkers (vs typical 10-15), spend 30-60 minutes per visit (vs typical 7 min), and optimize for performance — not just absence of disease. Medical and rehab coordinated under one roof.

**TRT safety:** Strong safety profile when properly monitored. We track hematocrit, PSA, lipids, estradiol.

**TRT and fertility:** Standard TRT can suppress sperm production. We offer HCG or enclomiphene to preserve fertility.

**Do I have to stay on TRT forever?** Not necessarily. Some men use long-term, others temporarily while making lifestyle changes. Individualized plans.

**TRT vs enclomiphene:** TRT replaces testosterone directly but doesn't preserve testicular function/fertility. Enclomiphene stimulates natural production and preserves fertility but may not achieve the same levels.

**Women's HRT safety:** Bioidentical hormones started around menopause are safe and protective for most women. The 2002 WHI study used synthetic hormones in older women — not bioidentical hormones in perimenopausal women.

**Do women need testosterone?** Yes. Women produce testosterone naturally (less than men). It declines with age. Low testosterone contributes to fatigue, low libido, difficulty building muscle, brain fog.

**GLP-1 muscle loss:** We track with DEXA to ensure fat loss while preserving muscle — not just scale weight.

**What happens when I stop GLP-1s?** Without lifestyle changes, weight often returns. We focus on building sustainable habits during treatment.

**Does Moonshot offer retatrutide?** We don't offer retatrutide yet — it's in Phase 3 clinical trials (TRIUMPH program) and is not yet FDA-approved. We currently offer semaglutide and tirzepatide. See our retatrutide resource hub at moonshotmp.com/learn/retatrutide/ for the latest clinical trial data and FDA timeline.

**DEXA frequency:** Every 6 months for optimization patients. Hormone programs include 2 scans/year.

**Chiropractic visits needed:** Most patients improve within 6-8 visits. Goal is to fix the problem, not create dependency.

**What peptides do you offer?** We offer BPC-157 ($250/mo), TB-500 ($250/mo), GHK-Cu ($175/mo), Sermorelin ($250/mo), PT-141 ($250/mo), plus the Wolverine Blend ($375/mo, BPC-157+TB-500) and Glow Stack ($400/mo, GHK-Cu+BPC-157+TB-500). All sourced from licensed 503A compounding pharmacies.

**How much do peptides cost?** Individual peptides range from $175-$250/month. Stacks (Wolverine Blend at $375/mo, Glow Stack at $400/mo) save money vs buying individually. All include medical oversight and injection training. Multi-month protocol bundles available: 3-month protocols save 15%, 6-month protocols save 20% (includes cycle-off month). Example: BPC-157 drops from $750 to $635 (3-mo) or $1,200 (6-mo).

**Are BPC-157 and TB-500 legal?** Yes. BPC-157 and TB-500 are available through licensed 503A compounding pharmacies, which prepare patient-specific prescriptions under a valid prescription from a provider. The FDA's 2024 action affected 503B bulk manufacturing facilities, but 503A pharmacies operate under a different regulatory framework.

**What is the Wolverine Blend?** The Wolverine Blend ($375/mo) combines BPC-157 and TB-500 in a single injection. BPC-157 promotes healing via growth factor upregulation while TB-500 accelerates tissue repair via actin upregulation — dual-pathway healing. Saves $125/mo vs purchasing both separately.

---

## Pricing Summary

| Service | Price |
|---------|-------|
| Comprehensive Blood Panel | $285 |
| DEXA Body Composition Scan | $150 |
| Performance Baseline Bundle (DEXA + Labs) | $405 |
| Men's Hormone Optimization | $235/month |
| Women's Hormone Optimization | $285/month |
| Weight Loss Program (GLP-1) | $405/month |
| Medical Oversight Only | $150/month |
| Prescription + Oversight | $105/month |
| BPC-157 | $250/month |
| TB-500 | $250/month |
| GHK-Cu | $175/month |
| Wolverine Blend (BPC-157 + TB-500) | $375/month |
| Glow Stack (GHK-Cu + BPC-157 + TB-500) | $400/month |
| Sermorelin | $250/month |
| PT-141 | $250/month |
| Daily Tadalafil | $70/month |
| HCG | $350/month |
| Enclomiphene | $200-208/month |
| NAD+ injection | $60/shot |
| B12 / MIC B / Glutathione injection | $30/shot |
| Vitamin C injection | $30-60/shot |

## Service Area
Park Ridge, IL and surrounding communities including Chicago (Edison Park, Norwood Park), Des Plaines, Niles, Rosemont, Morton Grove, Glenview, Skokie, Mount Prospect, Arlington Heights, Evanston, and the greater northwest suburbs. Approximately 30-mile service radius.

## Related Business
Moonshot CrossFit operates in the same building at 542 Busse Hwy — offers a continuum from rehab to fitness for patients ready to return to training. Train, recover, and optimize under one roof.`;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

function getClientIp(req) {
  // Netlify provides the real client IP in these headers
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function checkRateLimit(ip) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    client_ip: ip,
    max_requests: RATE_LIMIT_MAX,
    window_seconds: RATE_LIMIT_WINDOW,
  });

  if (error) {
    // If rate limit check fails, allow the request (fail open)
    console.warn("[chat] rate limit check failed:", error.message);
    return { allowed: true, current_count: 0 };
  }

  return data?.[0] || { allowed: true, current_count: 0 };
}

// ---------------------------------------------------------------------------
// OpenAI helpers
// ---------------------------------------------------------------------------

async function getEmbedding(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Embedding error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.data[0].embedding;
}

async function rewriteQuery(message, history) {
  const contextMessages = [];
  if (Array.isArray(history)) {
    const recent = history.slice(-2);
    for (const msg of recent) {
      if (msg && typeof msg.content === "string") {
        contextMessages.push(`${msg.role}: ${msg.content}`);
      }
    }
  }

  const contextBlock = contextMessages.length
    ? `\nRecent conversation:\n${contextMessages.join("\n")}\n`
    : "";

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REWRITE_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the user's question into a clear, specific search query for a medical clinic's knowledge base. Include relevant medical/clinical terms. Resolve pronouns using conversation context. Return ONLY the rewritten query, nothing else.",
          },
          {
            role: "user",
            content: `${contextBlock}User question: ${message}`,
          },
        ],
        temperature: 0,
        max_tokens: 100,
      }),
    });

    if (!resp.ok) {
      console.warn("[chat] query rewrite failed, using original message");
      return message;
    }

    const data = await resp.json();
    const rewritten = data.choices[0].message.content.trim();
    console.log(`[chat] rewritten query: "${rewritten}"`);
    return rewritten;
  } catch (err) {
    console.warn("[chat] query rewrite error:", err.message);
    return message;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

async function searchChunksHybrid(embedding, queryText, count = 5) {
  const supabase = getSupabase();

  // Try hybrid search first
  const { data, error } = await supabase.rpc("match_chunks_hybrid", {
    query_embedding: embedding,
    query_text: queryText,
    match_count: count,
  });

  if (!error && data?.length) return data;

  if (error) {
    console.warn(
      "[chat] hybrid search failed, falling back to vector-only:",
      error.message
    );
  }

  // Fallback to vector-only search
  return searchChunksVector(embedding, count);
}

async function searchChunksVector(embedding, count = 5) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: count,
  });

  if (error) {
    console.error("[chat] Supabase RPC error:", error.message);
    return [];
  }

  return data || [];
}

// ---------------------------------------------------------------------------
// Chat completion
// ---------------------------------------------------------------------------

async function getChatCompletion(messages) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.4,
      max_tokens: 800,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Chat error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function logQuery({
  query,
  rewrittenQuery,
  reply,
  topSimilarity,
  sources,
}) {
  const flagged =
    topSimilarity < LOW_SIMILARITY_THRESHOLD ||
    HEDGING_PATTERN.test(reply);

  const flagReason = [];
  if (topSimilarity < LOW_SIMILARITY_THRESHOLD) {
    flagReason.push(`low_similarity:${topSimilarity.toFixed(3)}`);
  }
  if (HEDGING_PATTERN.test(reply)) {
    flagReason.push("hedging_language");
  }

  const supabase = getSupabase();

  // Fire-and-forget — don't block the response
  supabase
    .from("chat_logs")
    .insert({
      query,
      rewritten_query: rewrittenQuery,
      reply,
      top_similarity: topSimilarity,
      sources: JSON.stringify(sources),
      flagged,
      flag_reason: flagReason.length ? flagReason.join(", ") : null,
    })
    .then(({ error }) => {
      if (error) console.warn("[chat] log insert failed:", error.message);
    });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async (req) => {
  if (req.method === "OPTIONS") return json(204, {});
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const body = await req.json().catch(() => ({}));
    const { message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return json(400, { error: "message is required" });
    }

    // 0. Rate limit check — before any OpenAI calls
    const clientIp = getClientIp(req);
    const rateCheck = await checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      console.warn(`[chat] rate limited IP ${clientIp} (${rateCheck.current_count} requests)`);
      return json(429, {
        reply: "You're sending messages too quickly. Please wait a few minutes and try again, or call us at (224) 435-4280.",
        sources: [],
      });
    }

    // 1. Rewrite query for better search
    console.log("[chat] rewriting query...");
    const searchQuery = await rewriteQuery(message.trim(), history);

    // 2. Embed the rewritten query
    console.log("[chat] embedding query...");
    const embedding = await getEmbedding(searchQuery);

    // 3. Hybrid search for relevant chunks
    console.log("[chat] searching chunks (hybrid)...");
    const chunks = await searchChunksHybrid(embedding, searchQuery, 5);
    console.log("[chat] found", chunks.length, "chunks");

    // 4. Build deduplicated sources array (by URL and title, pricing last)
    const seenUrls = new Set();
    const seenTitles = new Set();
    const sources = [];
    for (const c of chunks) {
      if (
        c.page_url &&
        !seenUrls.has(c.page_url) &&
        !seenTitles.has(c.page_title)
      ) {
        seenUrls.add(c.page_url);
        seenTitles.add(c.page_title);
        sources.push({ title: c.page_title, url: c.page_url });
      }
    }
    sources.sort((a, b) => {
      const aIsPricing = a.url.startsWith("/pricing") ? 1 : 0;
      const bIsPricing = b.url.startsWith("/pricing") ? 1 : 0;
      return aIsPricing - bIsPricing;
    });

    // 5. Build RAG context from retrieved chunks
    let ragContext = "";
    if (chunks.length > 0) {
      ragContext =
        "\n\n---\nAdditional relevant content from the website:\n\n" +
        chunks
          .map(
            (c) =>
              `[From: ${c.page_title} (${c.page_url})]\n${c.chunk_text}`
          )
          .join("\n\n");
    }

    // 6. Build messages array
    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          "\n\n---\nBase Knowledge:\n\n" +
          BASE_CONTEXT +
          ragContext,
      },
    ];

    // Append conversation history (last N messages)
    if (Array.isArray(history)) {
      const recent = history.slice(-MAX_HISTORY);
      for (const msg of recent) {
        if (
          msg &&
          (msg.role === "user" || msg.role === "assistant") &&
          typeof msg.content === "string"
        ) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current message (original, not rewritten)
    messages.push({ role: "user", content: message.trim() });

    // 7. Get completion
    const reply = await getChatCompletion(messages);

    // 8. Override sources for booking/appointment questions — only show booking link
    const bookingPattern = /\bbook(ing)?\b|schedul|appointment/i;
    const finalSources =
      bookingPattern.test(message) || bookingPattern.test(reply)
        ? [{ title: "Book an Appointment", url: "/booking/" }]
        : sources;

    // 9. Log query (fire-and-forget)
    const topSimilarity = chunks.length > 0 ? chunks[0].similarity : 0;
    logQuery({
      query: message.trim(),
      rewrittenQuery: searchQuery,
      reply,
      topSimilarity,
      sources: finalSources,
    });

    return json(200, { reply, sources: finalSources });
  } catch (err) {
    console.error("[chat] failed:", err);
    return json(500, { error: "Server error" });
  }
};
