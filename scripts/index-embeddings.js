#!/usr/bin/env node

/**
 * Content Indexing Script for Moonshot Chat RAG
 *
 * Reads public HTML pages, strips tags, chunks text, generates OpenAI embeddings,
 * and upserts to Supabase pgvector. Uses SHA-256 hashing to skip unchanged pages.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/index-embeddings.js
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, join, relative } from "path";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ROOT = resolve(import.meta.dirname, "..");

const CHUNK_WORDS = 400;
const OVERLAP_WORDS = 50;
const EMBEDDING_MODEL = "text-embedding-3-small";

// Directories / files to index (relative to ROOT)
const INCLUDE_GLOBS = [
  "index.html",
  "about/index.html",
  "ourstory/index.html",
  "contact/index.html",
  "pricing/index.html",
  "pricing/new/index.html",
  "medical/**/index.html",
  "learn/**/index.html",
  "rehab/**/index.html",
  "llms.txt",
];

// Paths to exclude (matched as prefixes against relative path)
const EXCLUDE_PREFIXES = [
  "admin/",
  "billing/",
  "partners/",
  "booking/",
  "404.html",
  "privacy/",
  "terms/",
  "womensnight/",
  "blood/",
  "supplements/",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkDir(dir, suffix, set) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, suffix, set);
    } else if (!suffix || entry.name === suffix || full.endsWith(suffix)) {
      set.add(full);
    }
  }
}

function collectFiles() {
  const files = new Set();

  for (const pattern of INCLUDE_GLOBS) {
    if (pattern.includes("**")) {
      const parts = pattern.split("**");
      const baseDir = resolve(ROOT, parts[0]);
      const suffix = parts[1]?.replace(/^\//, "") || "";
      walkDir(baseDir, suffix, files);
    } else {
      const full = resolve(ROOT, pattern);
      if (existsSync(full)) files.add(full);
    }
  }

  // Filter excludes
  const result = [];
  for (const f of files) {
    const rel = relative(ROOT, f);
    const excluded = EXCLUDE_PREFIXES.some((p) => rel.startsWith(p));
    if (!excluded) result.push(f);
  }

  return result.sort();
}

function stripHtml(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractPageTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (match) return match[1].replace(/\s+/g, " ").trim();
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]).trim();
  return "Untitled";
}

function chunkText(text) {
  const words = text.split(/\s+/);
  if (words.length <= CHUNK_WORDS) return [text];

  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_WORDS, words.length);
    chunks.push(words.slice(start, end).join(" "));
    start += CHUNK_WORDS - OVERLAP_WORDS;
    if (end === words.length) break;
  }
  return chunks;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function pageUrlFromPath(filePath) {
  let rel = relative(ROOT, filePath);
  if (rel.endsWith("/index.html")) rel = rel.replace(/\/index\.html$/, "/");
  else if (rel === "index.html") rel = "/";
  if (!rel.startsWith("/")) rel = "/" + rel;
  return rel;
}

async function getEmbeddings(texts) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI embedding error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.data.map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const files = collectFiles();
  console.log(`Found ${files.length} pages to check\n`);

  let indexed = 0;
  let skipped = 0;

  for (const filePath of files) {
    const raw = readFileSync(filePath, "utf-8");
    const isHtml = filePath.endsWith(".html");
    const text = isHtml ? stripHtml(raw) : raw;
    const title = isHtml ? extractPageTitle(raw) : "llms.txt";
    const pageUrl = pageUrlFromPath(filePath);
    const hash = sha256(text);

    // Check if hash matches existing
    const { data: existing } = await supabase
      .from("chat_embeddings")
      .select("content_hash")
      .eq("page_url", pageUrl)
      .limit(1);

    if (existing?.length && existing[0].content_hash === hash) {
      console.log(`  SKIP  ${pageUrl} (unchanged)`);
      skipped++;
      continue;
    }

    // Delete old chunks for this page
    await supabase.from("chat_embeddings").delete().eq("page_url", pageUrl);

    // Chunk text
    const chunks = chunkText(text);
    console.log(`  INDEX ${pageUrl} — ${chunks.length} chunks`);

    // Get embeddings (batch up to 20 at a time)
    const allEmbeddings = [];
    for (let i = 0; i < chunks.length; i += 20) {
      const batch = chunks.slice(i, i + 20);
      const embeddings = await getEmbeddings(batch);
      allEmbeddings.push(...embeddings);
    }

    // Insert rows
    const rows = chunks.map((chunk, i) => ({
      page_url: pageUrl,
      page_title: title,
      chunk_text: chunk,
      chunk_index: i,
      content_hash: hash,
      embedding: JSON.stringify(allEmbeddings[i]),
    }));

    const { error } = await supabase.from("chat_embeddings").insert(rows);
    if (error) {
      console.error(`  ERROR inserting ${pageUrl}:`, error.message);
    } else {
      indexed++;
    }
  }

  console.log(`\nDone: ${indexed} indexed, ${skipped} skipped (unchanged)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
