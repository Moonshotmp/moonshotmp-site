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

const SYSTEM_PROMPT = `You are the Moonshot Medical and Performance AI assistant. You help prospective and current patients learn about the clinic's services, pricing, team, and programs.

CRITICAL — Source of Truth Hierarchy:
- The "Base Knowledge" section below is the AUTHORITATIVE source of truth. It defines what the clinic offers, current pricing, and current services.
- "Additional relevant content" chunks are supplementary context from website articles. They may contain educational or historical information about services the clinic does NOT offer.
- If there is ANY conflict between Base Knowledge and a retrieved chunk, Base Knowledge wins. Always.
- ONLY list services and products that appear in Base Knowledge as current offerings. If something is described in a retrieved chunk but NOT listed in Base Knowledge as offered, do NOT tell the user we offer it.

Specific restrictions:
- We do NOT offer BPC-157 or TB-500. These are FDA-banned. If a retrieved chunk discusses them, it is educational content about WHY they are banned — never tell users we offer them.
- Our peptides are ONLY: Sermorelin ($250/mo), PT-141 ($250/mo), Tesamorelin ($300/mo).

Rules:
- Answer questions using ONLY the provided context. Do not make up information.
- If you're unsure or the answer isn't in the context, say so honestly and suggest contacting the clinic at 847-499-1266 or hello@moonshotmp.com.
- Be friendly, direct, and helpful. Match the clinic's tone: confident, no-BS, evidence-based.
- Keep answers concise — 2-4 sentences for simple questions, more for detailed clinical questions.
- When discussing pricing, always mention exact prices from the Base Knowledge.
- Do NOT include any links or URLs in your response EXCEPT the booking link. The chat interface will automatically display source links below your answer. Never generate markdown links.
- When someone asks how to book, schedule, or make an appointment, ALWAYS tell them to book online at moonshotmp.com/booking — this is the primary booking method. Also mention they can call 847-499-1266.
- Always end clinical/medical answers with: "This is general information — for personalized guidance, book a consultation at moonshotmp.com/booking."
- Never provide specific medical diagnoses or treatment recommendations for the user's personal health.
- If asked about topics unrelated to Moonshot Medical, politely redirect to clinic-related topics.`;

// Curated source of truth — the authoritative knowledge base for every query.
// This is NOT auto-generated. Edit manually when services/pricing change.
const BASE_CONTEXT = `# Moonshot Medical and Performance — Source of Truth

## Quick Summary
Moonshot Medical and Performance is a performance medicine clinic combining medical optimization with physical rehabilitation in Park Ridge, IL. We focus on taking people from "normal" to optimal — not waiting until something is broken to act. Data-driven, proactive, and evidence-based.

## Location & Contact
- Address: 542 Busse Hwy, Park Ridge, IL 60068
- Medical Phone: 847-499-1266
- Medical Email: hello@moonshotmp.com
- Rehab Phone: 224-435-4280
- Rehab Email: support@principleperformancehealth.com
- Website: https://moonshotmp.com
- Book Online: https://moonshotmp.com/booking (primary way to schedule any appointment)

## Hours
- Monday: 7am–3pm (Medical)
- Tuesday: 8am–1pm, 3pm–6pm (Rehab)
- Wednesday: 3pm–7pm (Medical), 8am–1pm, 3pm–6pm (Rehab)
- Thursday: 8am–1pm (Rehab)
- Friday: 7am–5pm (Medical), 8am–1pm, 3pm–5pm (Rehab)
- Saturday: 8am–2pm (Medical by appointment)
- Sunday: Closed

## Our Team

### Missy, NP — Medical Director
- Board-certified Nurse Practitioner
- Leads all medical optimization services
- Specializes in hormone optimization for men and women
- Expertise in metabolic health, GLP-1 weight loss, and peptide therapy

### Dr. Michael Gontarek — Partner, Physical Medicine
- Doctor of Chiropractic (DC)
- Master's in Clinical Nutrition (MSc)
- Diplomate of the American Clinical Board of Nutrition (DACBN)
- McKenzie Method certified (MDT)
- Evidence-based approach to spine and musculoskeletal care

### Supporting Team
- Sarah (RN, MSN): Registered Nurse supporting medical services
- Melissa: Medical Assistant, supports labs and DEXA scans
- Maria: Patient Experience & Brand Lead

---

## Medical Services

### Comprehensive Blood Panel — $285
60+ biomarkers including:
- Hormones: Total testosterone, free testosterone, estradiol, progesterone, DHEA-S, thyroid panel (TSH, free T3, free T4)
- Metabolic: Fasting glucose, HbA1c, insulin, lipid panel, ApoB
- Inflammation: CRP, homocysteine
- Nutrients: Vitamin D, B12, ferritin, iron panel, magnesium
- Organ function: Complete metabolic panel, liver enzymes, kidney function

Fasting: Minimum 8 hours (ideal 10-12). Water and black coffee allowed. Results in 3-5 business days.

### DEXA Body Composition Scan — $150
Medical-grade body composition analysis:
- Total body fat percentage and distribution
- Lean muscle mass by region (arms, legs, trunk)
- Bone mineral density (osteoporosis screening)
- Visceral adipose tissue (VAT)
- Android/gynoid fat ratio

Equipment: Hologic Horizon scanner (gold standard). Scan takes under 3 minutes. Supports patients up to 500 lbs.

Prep: Avoid eating/drinking 2 hours before. Wear comfortable clothing without metal. Results same day.

### Performance Baseline Bundle — $405 (save $30)
DEXA scan + comprehensive blood panel together. Best starting point for optimization.

### Men's Hormone Optimization — $208/month
For men experiencing low energy, decreased libido, brain fog, mood changes, difficulty building muscle, increased body fat, poor sleep.

Includes: Ongoing medical oversight, personalized protocol, 2 DEXA scans/year, comprehensive labs every 6 months, 1 vitamin shot/month, dosing adjustments, provider access.

Treatment options: Testosterone cypionate injections, testosterone cream, enclomiphene (fertility-preserving), HCG (fertility preservation).

### Women's Hormone Optimization — $208/month
For women experiencing perimenopause/menopause symptoms, hot flashes, sleep disturbances, mood changes, low libido, weight gain, bone density concerns.

Includes: Ongoing medical oversight, personalized protocol, 2 DEXA scans/year, comprehensive labs every 6 months, 1 vitamin shot/month, dosing adjustments, provider access.

Treatment options: Estradiol (patch, cream, or pellets), progesterone, testosterone, DHEA, thyroid optimization. All bioidentical hormones — molecularly identical to what the body produces.

### Weight Loss Program (GLP-1) — $405/month
Medications: Semaglutide (same active ingredient as Ozempic/Wegovy) or tirzepatide (same as Mounjaro/Zepbound).

Includes: GLP-1 medication, medical oversight, DEXA tracking (fat loss vs muscle loss), lab monitoring, dosing adjustments, nutrition guidance.

Average weight loss: 15-20% of body weight over 12-18 months.

### Prescription + Oversight Program — $105/month
For patients whose insurance covers GLP-1 or hormone medications. We write the prescription, provide medical oversight, lab work, dosing guidance, and provider access.

### Peptides
We offer the following peptides (all FDA-compliant):
- Sermorelin — $250/month: Growth hormone stimulant. Stimulates the body's natural GH production. Anti-aging, recovery, body composition. Improved sleep within days to weeks.
- PT-141 — $250/month: Sexual health peptide. Works on the nervous system (not blood flow). Improves desire and arousal for both men and women.
- Tesamorelin — $300/month: Growth hormone-releasing hormone analog. Reduces visceral fat, supports body composition.

We do NOT offer BPC-157 or TB-500. These are on the FDA banned list and are not available at our clinic.

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

Insurance: Blue Cross Blue Shield PPO accepted for rehab. HSA/FSA accepted.

### Chiropractic Care
Evidence-based chiropractic with Dr. Michael, McKenzie Method certified. Treats back pain, neck pain, joint pain, sports injuries. Goal is to fix the problem and teach self-management — most patients improve within 6-8 visits. No "maintenance adjustment" plans. Initial visit: 45-60 minutes. No referral needed in Illinois.

### Physical Rehabilitation
Movement restoration and strength-based rehabilitation. Process: Assess → Treat → Rebuild → Return. For post-injury recovery, chronic pain, and performance optimization.

### Trigger Point Injections
Targeted injections for chronic muscle pain — neck/shoulder tension, headaches, lower back spasms, fibromyalgia. Common patterns: upper trap (headaches), infraspinatus (shoulder/arm pain), piriformis (sciatica-like symptoms), QL (lower back/hip pain).

### Dry Needling
Thin filament needles targeting muscle trigger points. Based on modern neuroscience (not acupuncture). Effective for chronic tension, myofascial pain, headaches, tennis/golf elbow, TMJ, shoulder pain, back pain, hip pain, knee pain, plantar fasciitis. Soreness for 24-48 hours after treatment is normal.

### Shockwave Therapy (ESWT)
Acoustic wave therapy for chronic tendon injuries. 3-6 sessions, 1 week apart, 10-15 minutes each. 70-90% success rate for appropriate candidates. Full effects over 6-12 weeks. Effective for plantar fasciitis, Achilles tendinopathy, tennis/golf elbow, patellar tendinopathy, calcific tendinitis, hip bursitis, rotator cuff issues.

---

## FAQ

**Insurance:** Medical services are cash-pay only. Rehab accepts Blue Cross Blue Shield PPO. HSA/FSA accepted for most services.

**What makes Moonshot different?** We test 60+ biomarkers (vs typical 10-15), spend 30-60 minutes per visit (vs typical 7 min), and optimize for performance — not just absence of disease.

**TRT safety:** Strong safety profile when properly monitored. We track hematocrit, PSA, lipids, estradiol.

**TRT and fertility:** Standard TRT can suppress sperm production. We offer HCG or enclomiphene to preserve fertility.

**Do I have to stay on TRT forever?** Not necessarily. Some men use long-term, others temporarily while making lifestyle changes. Individualized plans.

**TRT vs enclomiphene:** TRT replaces testosterone directly but doesn't preserve testicular function/fertility. Enclomiphene stimulates natural production and preserves fertility but may not achieve the same levels.

**Women's HRT safety:** Bioidentical hormones started around menopause are safe and protective for most women. The 2002 WHI study used synthetic hormones in older women — not bioidentical hormones in perimenopausal women.

**Do women need testosterone?** Yes. Women produce testosterone naturally (less than men). It declines with age. Low testosterone contributes to fatigue, low libido, difficulty building muscle, brain fog.

**GLP-1 muscle loss:** We track with DEXA to ensure fat loss while preserving muscle — not just scale weight.

**What happens when I stop GLP-1s?** Without lifestyle changes, weight often returns. We focus on building sustainable habits during treatment.

**DEXA frequency:** Every 6 months for optimization patients. Hormone programs include 2 scans/year.

**Chiropractic visits needed:** Most patients improve within 6-8 visits. Goal is to fix the problem, not create dependency.

---

## Pricing Summary

| Service | Price |
|---------|-------|
| Comprehensive Blood Panel | $285 |
| DEXA Body Composition Scan | $150 |
| Performance Baseline Bundle (DEXA + Labs) | $405 |
| Men's Hormone Optimization | $208/month |
| Women's Hormone Optimization | $208/month |
| Weight Loss Program (GLP-1) | $405/month |
| Prescription + Oversight | $105/month |
| Sermorelin | $250/month |
| PT-141 | $250/month |
| Tesamorelin | $300/month |
| Daily Tadalafil | $70/month |
| HCG | $350/month |
| Enclomiphene | $200-208/month |
| NAD+ injection | $60/shot |
| B12 / MIC B / Glutathione injection | $30/shot |
| Vitamin C injection | $30-60/shot |

## Service Area
Park Ridge, IL and surrounding communities including Chicago, Des Plaines, Niles, Morton Grove, Glenview, Skokie, Evanston, and the greater northwest suburbs.

## Related Business
Moonshot CrossFit operates next door at the same address — offers a continuum from rehab to fitness for patients ready to return to training.`;

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

    // 4. Build deduplicated sources array (by URL and title, exclude llms.txt, pricing last)
    const seenUrls = new Set();
    const seenTitles = new Set();
    const sources = [];
    for (const c of chunks) {
      if (
        c.page_url &&
        !seenUrls.has(c.page_url) &&
        !seenTitles.has(c.page_title) &&
        c.page_url !== "/llms.txt"
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

    // 8. Log query (fire-and-forget)
    const topSimilarity = chunks.length > 0 ? chunks[0].similarity : 0;
    logQuery({
      query: message.trim(),
      rewrittenQuery: searchQuery,
      reply,
      topSimilarity,
      sources,
    });

    return json(200, { reply, sources });
  } catch (err) {
    console.error("[chat] failed:", err);
    return json(500, { error: "Server error" });
  }
};
