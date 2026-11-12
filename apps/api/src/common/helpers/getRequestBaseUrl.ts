import type { Request } from "express";

export const getRequestBaseUrl = (req: Request): string | null => {
  const headerOrigin = extractOriginFromHeaders(req);
  if (headerOrigin) return headerOrigin;

  return getRequestHostUrl(req);
};

export const getRequestHostUrl = (req: Request): string | null => {
  const host = req.get("host");
  if (!host) return null;

  const protocol = getRequestProtocol(req);

  return `${protocol}://${host}`.replace(/\/$/, "");
};

const extractOriginFromHeaders = (req: Request): string | null => {
  const requestOrigin = safeOriginFromHeader(req.headers.origin);
  if (requestOrigin) return requestOrigin;

  return safeOriginFromHeader(req.headers.referer);
};

const getRequestProtocol = (req: Request): string => {
  const forwardedProto = req.headers["x-forwarded-proto"];

  if (typeof forwardedProto === "string" && forwardedProto.length > 0) {
    return forwardedProto.split(",")[0].trim();
  }

  return req.protocol;
};

const safeOriginFromHeader = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return null;

  try {
    return new URL(value).origin.replace(/\/$/, "");
  } catch {
    return null;
  }
};
