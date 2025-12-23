import type { Request } from "express";

export function getSecret(request: Request) {
  return Array.isArray(request.headers["x-analytics-secret"])
    ? (request.headers["x-analytics-secret"][0] ?? null)
    : (request.headers["x-analytics-secret"] ?? null);
}
