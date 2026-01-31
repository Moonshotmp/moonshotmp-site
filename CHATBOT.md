# Moonshot AI Chatbot — RAG System

## What It Is

Site-wide AI assistant that answers questions about Moonshot Medical using the site's own content. Uses OpenAI for embeddings + chat, Supabase pgvector for vector storage, a Netlify Function for the API, and a floating chat widget on all public pages.

`llms.txt` (376 lines) is included as base context on every query. RAG supplements it with deeper content from learn articles and service pages.

## Architecture

```
User types question
  → chat-widget.js (client)
  → POST /.netlify/functions/chat
  → Embed question (OpenAI text-embedding-3-small)
  → Similarity search (Supabase pgvector, top 5 chunks)
  → Build prompt: system instructions + llms.txt + RAG chunks + conversation history
  → OpenAI gpt-4o-mini completion
  → Return answer to widget
```

## File Map

| File | Purpose |
|------|---------|
| `shared/chat-widget.js` | Client-side chat UI (IIFE, injected by footer.js) |
| `netlify/functions/chat.js` | RAG chat API endpoint |
| `scripts/index-embeddings.js` | Content indexing script (run locally) |
| `shared/footer.js` | Loads chat widget on all pages (3 lines added) |
| `llms.txt` | Base context included in every query |

## Supabase Setup

Run these in Supabase SQL Editor (one-time):

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
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

-- Create similarity search function
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  page_url TEXT,
  page_title TEXT,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.page_url,
    ce.page_title,
    ce.chunk_text,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM chat_embeddings ce
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## How to Re-Index

```bash
OPENAI_API_KEY=sk-... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/index-embeddings.js
```

- Uses SHA-256 hashing to skip unchanged pages automatically
- Only pages with actual content changes hit the OpenAI API
- Re-run anytime after content updates — fast and cheap

## Environment Variables

Add to Netlify dashboard:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key (embeddings + chat) |
| `SUPABASE_URL` | Already set (used by other functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set (used by other functions) |

## How to Modify

### System prompt
Edit `SYSTEM_PROMPT` in `netlify/functions/chat.js` (line ~23).

### Base context
Edit `BASE_CONTEXT` in `netlify/functions/chat.js`. This is a condensed version of `llms.txt` included in every query.

### Pages indexed
Edit `INCLUDE_GLOBS` and `EXCLUDE_PREFIXES` in `scripts/index-embeddings.js`.

### Chunk size
Edit `CHUNK_WORDS` and `OVERLAP_WORDS` in `scripts/index-embeddings.js`. Default: 400 words with 50-word overlap.

### Chat model
Edit `CHAT_MODEL` in `netlify/functions/chat.js`. Default: `gpt-4o-mini`.

### Widget styling
Edit `shared/chat-widget.js`. Uses Tailwind classes with brand colors.

## How the Widget Loads

`footer.js` dynamically creates a `<script>` tag for `chat-widget.js` at the end of its IIFE. This means the chatbot appears on every page that includes footer.js (all public pages). The widget self-excludes from `/admin/`, `/billing/`, and `/partners/` paths.

## Cost

| Component | Cost |
|-----------|------|
| Indexing ~30 pages (one-time) | < $0.01 |
| Per chat query | ~$0.001 |
| 1,000 queries/month | ~$1 |
| 10,000 queries/month | ~$10 |
