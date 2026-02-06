import { tenants } from "src/storage/schema";
import { deleteCacheKey, getCachedJson, setCachedJson } from "src/utils/redis-cache";

import type { DatabasePg } from "src/common";

type CorsOriginValue = string | string[] | boolean;
type CorsOriginCallback = (err: Error | null, origin: boolean) => void;
type CorsOriginFunction = (origin: string | undefined, callback: CorsOriginCallback) => void;

const splitOrigins = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const getEnvOrigins = (): string[] => {
  const baseOrigins = splitOrigins(process.env.CORS_ORIGIN);
  const devOrigins = splitOrigins(process.env.DEV_TENANT_ORIGINS);

  return Array.from(new Set([...baseOrigins, ...devOrigins]));
};

const REDIS_CACHE_TTL_SECONDS = 60 * 60;
const REDIS_CACHE_KEY = "cors:tenant-origins";

const getTenantOrigins = async (dbBase: DatabasePg): Promise<string[]> => {
  const cached = await getCachedJson<string[]>(REDIS_CACHE_KEY);

  if (Array.isArray(cached)) return cached;

  const queriedTenants = await dbBase.select({ host: tenants.host }).from(tenants);
  const tenantHosts = queriedTenants.map((tenant) => tenant.host).filter(Boolean);

  await setCachedJson(REDIS_CACHE_KEY, tenantHosts, REDIS_CACHE_TTL_SECONDS);

  return tenantHosts;
};

export const invalidateCorsCache = async () => {
  await deleteCacheKey(REDIS_CACHE_KEY);
};

export const createCorsOriginOption = (
  dbBase: DatabasePg,
): CorsOriginValue | CorsOriginFunction => {
  return (origin, callback) => {
    if (!origin) return callback(null, true);

    getTenantOrigins(dbBase)
      .then((tenantOrigins) => {
        const envOrigins = getEnvOrigins();
        const allowedOrigins = Array.from(new Set([...envOrigins, ...tenantOrigins]));

        if (allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);

        return callback(new Error("Not allowed by CORS"), false);
      })
      .catch((error) => callback(error as Error, false));
  };
};
