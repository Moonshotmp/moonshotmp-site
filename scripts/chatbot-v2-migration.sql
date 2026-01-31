-- ============================================================================
-- Chatbot v2 — Supabase SQL Migration
-- ============================================================================
-- Run these statements in the Supabase SQL Editor (Dashboard → SQL Editor).
-- They are safe to run on an existing chat_embeddings table.
-- After running, re-index all pages: node scripts/index-embeddings.js
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add page_weight column (Improvement 2: Page Weight Scoring)
-- ---------------------------------------------------------------------------

ALTER TABLE chat_embeddings ADD COLUMN IF NOT EXISTS page_weight REAL DEFAULT 1.0;

-- ---------------------------------------------------------------------------
-- 2. Add full-text search column + index (Improvement 3: Hybrid Search)
-- ---------------------------------------------------------------------------

ALTER TABLE chat_embeddings ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED;

CREATE INDEX IF NOT EXISTS idx_chat_embeddings_fts ON chat_embeddings USING gin(fts);

-- ---------------------------------------------------------------------------
-- 3. Update match_chunks to include page_weight (Improvement 2)
-- ---------------------------------------------------------------------------

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
    (1 - (ce.embedding <=> query_embedding)) * ce.page_weight AS similarity
  FROM chat_embeddings ce
  ORDER BY (1 - (ce.embedding <=> query_embedding)) * ce.page_weight DESC
  LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Create hybrid search function with RRF (Improvement 3)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION match_chunks_hybrid(
  query_embedding VECTOR(1536),
  query_text TEXT,
  match_count INT DEFAULT 5,
  rrf_k INT DEFAULT 60
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
  WITH vector_results AS (
    SELECT ce.id, ce.page_url, ce.page_title, ce.chunk_text,
           ROW_NUMBER() OVER (ORDER BY (ce.embedding <=> query_embedding) ASC) AS rank_ix,
           (1 - (ce.embedding <=> query_embedding)) * ce.page_weight AS vec_score
    FROM chat_embeddings ce
    ORDER BY ce.embedding <=> query_embedding
    LIMIT 20
  ),
  fts_results AS (
    SELECT ce.id, ce.page_url, ce.page_title, ce.chunk_text,
           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(ce.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix,
           ts_rank_cd(ce.fts, websearch_to_tsquery('english', query_text)) AS fts_score
    FROM chat_embeddings ce
    WHERE ce.fts @@ websearch_to_tsquery('english', query_text)
    ORDER BY fts_score DESC
    LIMIT 20
  ),
  combined AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.page_url, f.page_url) AS page_url,
      COALESCE(v.page_title, f.page_title) AS page_title,
      COALESCE(v.chunk_text, f.chunk_text) AS chunk_text,
      COALESCE(1.0 / (rrf_k + v.rank_ix), 0.0) +
      COALESCE(1.0 / (rrf_k + f.rank_ix), 0.0) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.id = f.id
  )
  SELECT c.id, c.page_url, c.page_title, c.chunk_text, c.rrf_score AS similarity
  FROM combined c
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Create chat_logs table (Improvement 6: Low-Confidence Logging)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chat_logs (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  rewritten_query TEXT,
  reply TEXT NOT NULL,
  top_similarity FLOAT,
  sources JSONB,
  flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
