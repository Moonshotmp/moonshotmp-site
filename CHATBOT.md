# Moonshot AI Chatbot — RAG System (v2)

## What It Is

Site-wide AI assistant that answers questions about Moonshot Medical using the site's own content. Uses OpenAI for embeddings + chat, Supabase pgvector for vector storage, a Netlify Function for the API, and a floating chat widget on all public pages.

`llms.txt` (376 lines) is included as base context on every query. RAG supplements it with deeper content from learn articles and service pages.

## Architecture

```
User types question
  → chat-widget.js (client)
  → POST /.netlify/functions/chat
  → Rewrite query (gpt-4o-mini — converts vague input to precise search query)
  → Embed rewritten query (OpenAI text-embedding-3-small)
  → Hybrid search: vector similarity + full-text keyword search (Supabase RPC, RRF merge)
  → Results ranked by: (similarity * page_weight) via Reciprocal Rank Fusion
  → Build prompt: system instructions + llms.txt + RAG chunks + conversation history
  → OpenAI gpt-4o-mini completion
  → Return { reply, sources[] } to widget
  → Widget renders answer + source link pills
  → Log query to chat_logs (fire-and-forget)
```

## v2 Improvements

### 1. Source URLs from API
The API returns a deduplicated `sources` array alongside the reply. The widget renders these as clickable link pills below each answer. The LLM no longer generates links — eliminating URL hallucination entirely.

### 2. Page Weight Scoring
Each chunk has a `page_weight` column (default 1.0). Higher-value pages rank higher:
- `1.5`: `/pricing/`, `/llms.txt`
- `1.3`: `/medical/**`
- `1.2`: `/rehab/**`, `/about/`, `/ourstory/`
- `1.0`: everything else

### 3. Hybrid Search (Vector + Full-Text with RRF)
Queries run both vector similarity search and PostgreSQL full-text search. Results are merged using Reciprocal Rank Fusion (RRF). This ensures exact keyword matches (e.g., "BPC-157", "tirzepatide") surface the right pages even when semantic similarity alone is weak.

### 4. Header-Based Chunking
Content is split on `<h2>`/`<h3>` boundaries instead of arbitrary word counts. Each chunk is prefixed with its section heading for better embedding context. Sections exceeding 500 words are sub-chunked with overlap. For markdown files (llms.txt), splits on `## ` headers.

### 5. Query Rewriting
A fast gpt-4o-mini call rewrites vague queries ("what do you guys do", "how much is that?") into precise search queries with medical/clinical terms. Uses last 2 conversation messages for pronoun resolution. Falls back to original message on failure.

### 6. Low-Confidence Logging
All queries are logged to `chat_logs` table. Queries are flagged when:
- Top chunk similarity < 0.3
- Reply contains hedging language ("I'm not sure", "contact the clinic")

Review flagged queries in Supabase to identify content gaps.

## File Map

| File | Purpose |
|------|---------|
| `shared/chat-widget.js` | Client-side chat UI (IIFE, injected by footer.js) |
| `netlify/functions/chat.js` | RAG chat API endpoint |
| `scripts/index-embeddings.js` | Content indexing script (run locally) |
| `shared/footer.js` | Loads chat widget on all pages (3 lines added) |
| `llms.txt` | Base context included in every query |
| `scripts/chatbot-v2-migration.sql` | SQL migration reference (run in Supabase dashboard) |

## Supabase Setup

### Initial Setup (v1 — already done)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chat_embeddings (
  id BIGSERIAL PRIMARY KEY,
  page_url TEXT NOT NULL,
  page_title TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_url, chunk_index)
);

CREATE INDEX ON chat_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 20);
```

### v2 Migration (run in Supabase SQL Editor)

See `scripts/chatbot-v2-migration.sql` for the full SQL. Summary:

1. Add `page_weight` column to `chat_embeddings`
2. Add `fts` generated tsvector column + GIN index
3. Create `match_chunks_hybrid` RPC function (vector + FTS with RRF)
4. Update `match_chunks` RPC to include page weight
5. Create `chat_logs` table for query logging

## How to Re-Index

```bash
OPENAI_API_KEY=sk-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/index-embeddings.js
```

- Uses SHA-256 hashing to skip unchanged pages automatically
- Only pages with actual content changes hit the OpenAI API
- After v2 migration, re-run to populate `page_weight` and new chunk format
- Re-run anytime after content updates — fast and cheap

## Environment Variables

Add to Netlify dashboard:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key (embeddings + chat + query rewriting) |
| `SUPABASE_URL` | Already set (used by other functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set (used by other functions) |

## How to Modify

### System prompt
Edit `SYSTEM_PROMPT` in `netlify/functions/chat.js`.

### Base context
Edit `BASE_CONTEXT` in `netlify/functions/chat.js`. This is a condensed version of `llms.txt` included in every query.

### Pages indexed
Edit `INCLUDE_GLOBS` and `EXCLUDE_PREFIXES` in `scripts/index-embeddings.js`.

### Page weights
Edit `PAGE_WEIGHT_RULES` in `scripts/index-embeddings.js`.

### Chunk size
Edit `MAX_SECTION_WORDS` and `OVERLAP_WORDS` in `scripts/index-embeddings.js`. Default: 500 words max per section with 50-word overlap for sub-chunking.

### Chat model
Edit `CHAT_MODEL` in `netlify/functions/chat.js`. Default: `gpt-4o-mini`.

### Query rewriting
Edit `rewriteQuery()` in `netlify/functions/chat.js`. Uses `REWRITE_MODEL` (gpt-4o-mini) with temperature 0.

### Low-confidence threshold
Edit `LOW_SIMILARITY_THRESHOLD` and `HEDGING_PATTERN` in `netlify/functions/chat.js`.

### Widget styling
Edit `shared/chat-widget.js`. Uses Tailwind classes with brand colors. Source pills use custom `.ms-source-pill` CSS.

## How the Widget Loads

`footer.js` dynamically creates a `<script>` tag for `chat-widget.js` at the end of its IIFE. This means the chatbot appears on every page that includes footer.js (all public pages). The widget self-excludes from `/admin/`, `/billing/`, and `/partners/` paths.

## Cost

| Component | Cost |
|-----------|------|
| Indexing ~30 pages (one-time) | < $0.01 |
| Per chat query (with rewrite) | ~$0.0011 |
| 1,000 queries/month | ~$1.10 |
| 10,000 queries/month | ~$11 |

Query rewriting adds ~$0.0001 per query (negligible).

## Monitoring

Check the `chat_logs` table in Supabase for:
- **Flagged queries** (`flagged = true`): Low similarity or hedging responses — indicates content gaps
- **Query vs rewritten_query**: See how the rewriter transforms vague input
- **top_similarity scores**: Track retrieval quality over time
- **sources**: See which pages are being surfaced for each query
