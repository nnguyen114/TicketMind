-- =====================================================================
-- V4 -- Drop ticket_embeddings.
--
-- V2 created this table for embeddings the backend was going to compute
-- itself. It never did: there is no entity, no repository and no query
-- against it anywhere in src/main. The RAG service went a different way and
-- owns its own kb_documents table, deliberately not this one -- see the note
-- at the top of rag-service/src/ticketmind_rag/db.py.
--
-- Dropping it takes its indexes, its RLS policy and its grants with it.
-- =====================================================================
DROP TABLE IF EXISTS ticket_embeddings;

-- The vector extension deliberately stays. V2's CREATE EXTENSION is
-- load-bearing for compose startup: the RAG service issues its own
-- CREATE EXTENSION IF NOT EXISTS on boot, and running both concurrently can
-- fail with a duplicate-key or "tuple concurrently updated" error. Startup is
-- ordered postgres -> backend -> rag-service so Flyway always wins that race
-- and the RAG service's copy is an unconditional no-op. Dropping the
-- extension here would hand the race back.
