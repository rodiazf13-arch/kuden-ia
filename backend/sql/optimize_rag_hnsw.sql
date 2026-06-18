-- =========================================================================
-- SCRIPT: optimize_rag_hnsw
-- PROPÓSITO: Crear un índice HNSW para la tabla document_chunks para acelerar RAG
-- =========================================================================

-- Asegurarse de que la extensión vector esté instalada (debería estarlo si ya usan pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Fijar las dimensiones del vector. pgvector requiere saber la dimensión exacta (768 para Gemini y text-embedding-3-small)
-- para poder crear el índice HNSW. Si no se fija, lanza el error "column does not have dimensions".
ALTER TABLE public.document_chunks ALTER COLUMN embedding TYPE vector(768);

-- Eliminar índices antiguos si existieran (ej. ivfflat u otros hnsw con configuraciones distintas)
-- DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Crear el índice HNSW
-- Utilizamos vector_cosine_ops porque la similitud del coseno es la más recomendada para embeddings de LLMs.
-- m = 16 (número máximo de conexiones por capa, 16 es el default y buen balance)
-- ef_construction = 64 (tamaño de la lista de candidatos dinámica en construcción, 64 es el default)
CREATE INDEX ON public.document_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
