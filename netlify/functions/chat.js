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

Rules:
- Answer questions using ONLY the provided context (base knowledge + retrieved content). Do not make up information.
- If you're unsure or the answer isn't in the context, say so honestly and suggest contacting the clinic at 847-499-1266 or hello@moonshotmp.com.
- Be friendly, direct, and helpful. Match the clinic's tone: confident, no-BS, evidence-based.
- Keep answers concise — 2-4 sentences for simple questions, more for detailed clinical questions.
- When discussing pricing, always mention exact prices from the context.
- Do NOT include any links or URLs in your response. The chat interface will automatically display source links below your answer. Never generate markdown links.
- Always end clinical/medical answers with: "This is general information — for personalized guidance, book a consultation with our team."
- Never provide specific medical diagnoses or treatment recommendations for the user's personal health.
- If asked about topics unrelated to Moonshot Medical, politely redirect to clinic-related topics.`;

// Full llms.txt content — the base knowledge layer for every query
const BASE_CONTEXT = `# Moonshot Medical and Performance
> Medical optimization and physical rehabilitation clinic in Park Ridge, IL

## Quick Summary
Moonshot Medical and Performance is a performance medicine clinic combining medical optimization with physical rehabilitation. We focus on taking people from "normal" to optimal—not waiting until something is broken to act. Data-driven, proactive, and evidence-based.

## Location & Contact
- Address: 542 Busse Hwy, Park Ridge, IL 60068
- Medical Phone: 847-499-1266
- Rehab Phone: 224-435-4280
- Email: hello@moonshotmp.com
- Website: https://moonshotmp.com
- Hours: Monday 7am–3pm, Wednesday 3–7pm, Friday 7am–5pm, Saturday 8am–2pm

## Our Team

### Missy, NP — Medical Director
- Board-certified Nurse Practitioner
- Leads all medical optimization services
- Specializes in hormone optimization for men and women
- Expertise in metabolic health, GLP-1 weight loss, and peptide therapy
- Takes a data-driven, individualized approach to patient care

### Dr. Michael — Partner, Physical Medicine
- Doctor of Chiropractic (DC)
- Master's in Clinical Nutrition (MSc)
- Diplomate of the American Clinical Board of Nutrition (DACBN)
- McKenzie Method certified (MDT)
- Evidence-based approach to spine and musculoskeletal care
- Focus on patient education and self-treatment

### Supporting Team
- Sarah (RN, MSN): Registered Nurse supporting medical services
- Melissa: Medical Assistant, supports labs and DEXA scans
- Maria: Patient Experience & Brand Lead

---

## Medical Services

### Comprehensive Blood Panels — $285
60+ biomarkers analyzed including:
- Hormones: Total testosterone, free testosterone, estradiol, progesterone, DHEA-S, thyroid panel (TSH, free T3, free T4)
- Metabolic: Fasting glucose, HbA1c, insulin, lipid panel, ApoB
- Inflammation: CRP, homocysteine
- Nutrients: Vitamin D, B12, ferritin, iron panel, magnesium
- Organ function: Complete metabolic panel, liver enzymes, kidney function

Why it matters: Standard primary care panels test 10-15 markers. We test 60+ because optimization requires seeing the full picture—not just checking for disease.

### DEXA Body Composition Scan — $150
Medical-grade body composition analysis measuring:
- Total body fat percentage and distribution
- Lean muscle mass by region (arms, legs, trunk)
- Bone mineral density (osteoporosis screening)
- Visceral adipose tissue (VAT) — the dangerous fat around organs
- Android/gynoid fat ratio

Equipment: Hologic Horizon scanner (gold standard in research and clinical settings)

### Performance Baseline Bundle — $405 (save $30)
DEXA scan + comprehensive blood panel together. Best starting point for anyone serious about optimization.

### Men's Hormone Optimization — $208/month
Testosterone replacement therapy (TRT) and hormone optimization for men experiencing low energy, decreased libido, brain fog, mood changes, difficulty building muscle, increased body fat, poor sleep.

What's included: Ongoing medical oversight, personalized protocol, 2 DEXA scans/year, comprehensive labs every 6 months, 1 vitamin shot/month, dosing adjustments.

Treatment options: Testosterone cypionate injections, testosterone cream, enclomiphene (fertility-preserving), HCG (fertility preservation).

### Women's Hormone Optimization — $208/month
Bioidentical hormone replacement therapy (BHRT) for women experiencing perimenopause/menopause symptoms, hot flashes, sleep disturbances, mood changes, low libido, weight gain, bone density concerns.

What's included: Ongoing medical oversight, personalized protocol, 2 DEXA scans/year, comprehensive labs every 6 months, 1 vitamin shot/month, dosing adjustments.

Treatment options: Estradiol (patch, cream, or pellets), progesterone, testosterone, DHEA, thyroid optimization. We use bioidentical hormones—molecularly identical to what your body produces.

### Weight Loss Program (GLP-1) — $405/month
Medical weight loss using semaglutide or tirzepatide with DEXA tracking to ensure fat loss while preserving muscle.

What's included: GLP-1 medication, medical oversight, DEXA tracking, lab monitoring, dosing adjustments, nutrition guidance.

### Prescription + Oversight Program — $105/month
For patients whose insurance covers GLP-1 or hormone medications. We write the prescription, provide medical oversight, lab work, dosing guidance, and provider access.

### Peptides
BPC-157 (tissue healing, gut repair), TB-500 (recovery, inflammation), NAD+ (cellular energy, longevity), and others based on individual needs.

### Daily Tadalafil
Daily low-dose tadalafil (2.5-5mg) for improved blood flow, prostate health, endothelial function, mild blood pressure reduction. Often combined with TRT.

---

## Rehab Services

### Chiropractic Care
Evidence-based chiropractic with Dr. Michael, McKenzie Method certified. Treats back pain, neck pain, joint pain, sports injuries. Goal is to fix the problem and teach self-management — most patients improve within 6-8 visits.

### Physical Rehabilitation
Movement restoration and strength-based rehabilitation.

### Trigger Point Injections
For chronic muscle pain — neck/shoulder tension, headaches, lower back spasms, fibromyalgia.

### Dry Needling
Thin filament needles targeting trigger points. Effective for chronic tension, myofascial pain, headaches, tennis/golf elbow, TMJ.

### Shockwave Therapy (ESWT)
Acoustic wave therapy for plantar fasciitis, Achilles tendinopathy, tennis elbow, rotator cuff issues, patellar tendinopathy.

---

## FAQ

**Insurance:** Rehab accepts Blue Cross Blue Shield PPO. Medical services are cash-pay only. HSA/FSA accepted.

**TRT safety:** Strong safety profile when properly monitored. We track hematocrit, PSA, lipids, estradiol.

**TRT and fertility:** Standard TRT can suppress sperm production. We offer HCG or enclomiphene to preserve fertility.

**Women's HRT safety:** Bioidentical hormones started around menopause are safe and protective for most women.

**GLP-1 muscle loss:** We track with DEXA to ensure fat loss while preserving muscle.

**DEXA frequency:** Every 6 months for optimization patients. Hormone programs include 2 scans/year.

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

## Service Area
Park Ridge, IL and surrounding communities including Chicago, Des Plaines, Niles, Morton Grove, Glenview, Skokie, Evanston, and the greater northwest suburbs.

## Related Business
Moonshot CrossFit operates next door at the same address.`;

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

    // 4. Build deduplicated sources array
    const seenUrls = new Set();
    const sources = [];
    for (const c of chunks) {
      if (c.page_url && !seenUrls.has(c.page_url)) {
        seenUrls.add(c.page_url);
        sources.push({ title: c.page_title, url: c.page_url });
      }
    }

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
