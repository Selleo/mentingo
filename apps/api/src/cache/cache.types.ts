import type { createCache } from "cache-manager";

export const CACHE_MANAGER_TOKEN = Symbol("CACHE_MANAGER");

export type Cache = ReturnType<typeof createCache>;
