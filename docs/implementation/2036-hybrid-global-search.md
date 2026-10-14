# #2036 Hybrid global search

The sparkle action runs PostgreSQL FTS and semantic retrieval together and merges entity rankings with reciprocal rank fusion. Regular typing remains keyword search. The sparkle is shown only when the existing `useAIConfigured` check confirms effective core/OpenAI credentials (including the existing server-key fallback). It stays hidden while configuration is unknown and returns to keyword mode when configuration is removed. Index coverage does not gate the button; pending-index and provider-outage notices continue to work. Reranking is intentionally omitted.

## Index and model

`search_documents` remains the canonical localized search projection. `search_chunks` holds readable text, a GIN-indexed FTS vector, and a 1536-dimensional embedding per chunk. Stable source keys, content hashes, file revisions, and model/index versions prevent stale chunks from being retrieved while asynchronous processing catches up.

Search uses the existing core embedding credentials with a pinned `text-embedding-3-small` model. Query embedding requests time out after 3 seconds and fall back to FTS; indexing requests have a 30-second timeout. It does not switch to Luma vectors on failure. Changing the model or chunking format requires a new index version and reindexing before querying the replacement vector space.

Semantic retrieval uses a cosine HNSW index with `m=16` and `ef_construction=64`. The query sets transaction-local `hnsw.ef_search=200` and `hnsw.iterative_scan=strict_order`; pgvector >=0.8.0 is required and checked by a generated preflight migration before the HNSW index migration.

Nearest-chunk retrieval applies tenant, entity access, language, model/version, current source hash, and file revision/visibility filters inside the candidate query. A correlated source lookup deliberately uses `OFFSET 0` to prevent PostgreSQL from flattening it into a join that sorts all distances and bypasses HNSW. A materialized nearest-candidate CTE orders directly by cosine distance and limits chunks before entity aggregation. The distance threshold is applied outside that CTE.

The first batch retrieves up to 200 chunks. If it fills the budget but returns fewer than 50 distinct relevant entities, additional batches exclude already found entities and expand to 400, 800, then 1600 chunks. The maximum is four ANN batches / 3000 candidates. This bounds work while preventing a long attachment from occupying every result. Rankings are merged by entity before FTS fusion. Retrieval stops when no candidates remain; it does not run an exact semantic scan. Approximate retrieval can return fewer or no semantic matches under restrictive filters; FTS results remain available. Production-sized latency and live-model relevance still need measurement; production-sized latency and live-model relevance still need measurement, especially for very selective tenants/access scopes.

## Lifecycle and old data

A minute-based reconciler reads committed canonical sources and enqueues bounded BullMQ jobs. This is the durable recovery mechanism: it does not enqueue provider work from uncommitted content writes. Tenant ordering and source pagination rotate between cycles. Workers reread current sources, prepare all chunks, then validate revisions and atomically replace a source's chunk set. Readers exclude stale/deleted/detached/archived or newly restricted file content immediately, without waiting for cleanup.

Apply the generated migrations through the existing deployment migration flow. There are no network calls or embeddings inside migrations. Existing sources are picked up automatically by background reconciliation; no manual backfill command is required.

Queue capacity is bounded to 500 waiting/active/delayed jobs, with indexing concurrency of two per application process, four retry attempts, and exponential backoff. Retained failures can be retried by reconciliation after one day.

## File and visibility boundaries

Only lesson attachments are expanded into file text. PDF, DOCX, and TXT reuse the existing extraction pipeline, with a 10 MB file limit, one million extracted characters, and 500 chunks per source. Scanned PDFs require a future OCR capability. Unsupported file types retain searchable filename/title metadata.

Hidden files, assessment answer options/solution explanations, and private AI Mentor context are excluded from semantic indexing. Private file passages are restricted to the uploader or resource-library managers, in addition to lesson access. Files attached to multiple entities/locales currently produce separate source chunk sets; extraction and embeddings can repeat across those sources.

The UI reports incomplete indexing until all eligible visible sources have current chunks. Failed extraction/provider jobs also keep that coverage incomplete; inspect the semantic indexing queue and worker logs to diagnose them. File content contributes to FTS in hybrid mode, including during query-provider outages when current chunks already exist.

## Verification

Focused API tests cover fusion, fallback, chunking, provider validation, extraction limits, and revision activation. Frontend component tests cover explicit submission, reset, keyboard controls, passages, status messages, and query limits. The isolated PostgreSQL suite applies the actual migrations and verifies deterministic semantic retrieval, FTS excerpts, RLS, before-limit access, file invalidation/visibility, languages, and index coverage. These checks do not establish live embedding relevance, production performance, or authenticated browser behavior.

### HNSW coverage

The opt-in PostgreSQL suite checks natural HNSW index selection, result limits, entity deduplication and access filtering with a deterministic 2,960-vector fixture. Unit tests cover transaction-local scan settings, bounded candidate expansion, relevance-floor handling and stopping on empty ANN batches without an exact semantic query. The updated tests were not run locally; CI owns validation for this change. These checks do not establish production latency or semantic recall under restrictive access filters.
