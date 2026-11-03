export const SEMANTIC_SEARCH_MODEL = "text-embedding-3-small";
export const SEMANTIC_SEARCH_INDEX_VERSION = 1;
export const SEMANTIC_SEARCH_EMBEDDING_DIMENSIONS = 1536;
// search_chunks.embedding is vector(1536); another size needs a schema migration first.
export const SEMANTIC_SEARCH_SUPPORTED_EMBEDDING_DIMENSIONS = [1536] as const;
export const SEMANTIC_SEARCH_BATCH_SIZE = 50;
export const SEMANTIC_SEARCH_MAX_EXTRACTED_CHARACTERS = 1_000_000;
export const SEMANTIC_SEARCH_MAX_CHUNKS = 500;
export const SEMANTIC_SEARCH_ENTITY_LIMIT = 50;
export const SEMANTIC_SEARCH_INITIAL_CANDIDATES = 200;
export const SEMANTIC_SEARCH_MAX_CANDIDATE_BATCHES = 4;
export const SEMANTIC_SEARCH_HNSW_EF_SEARCH = 200;
// Provisional precision-first floor (cosine similarity >= 0.55); calibrate against judged queries.
export const SEMANTIC_SEARCH_MAX_DISTANCE = 0.45;
