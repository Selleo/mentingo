// Hardcoded for now — move to EXPO_PUBLIC_* env or app.config.ts when we ship.
// TENANT_HOST is sent as X-Tenant-Host so the backend can resolve the tenant
// without an Origin header (see apps/api/src/storage/db/tenant-resolver.service.ts).
export const TENANT_HOST = "https://tenant1.lms.localhost";
export const API_BASE_URL = "https://tenant1.lms.localhost/api";
