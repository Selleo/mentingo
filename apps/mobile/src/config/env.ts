// Hardcoded for now — move to EXPO_PUBLIC_* env or app.config.ts when we ship.
// TENANT_HOST is sent as X-Tenant-Host so the backend can resolve the tenant
// without an Origin header (see apps/api/src/storage/db/tenant-resolver.service.ts).
// API_BASE_URL hits the Nest API directly on loopback (iOS Simulator shares the
// host's network); this bypasses Caddy so the simulator doesn't have to trust
// Caddy's local root CA.
export const TENANT_HOST = "https://tenant1.lms.localhost";
export const API_BASE_URL = "http://localhost:3000/api";
