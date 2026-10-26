import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PHISHING_SIGNATURE_MAX_AGE_MS,
  PHISHING_WEBHOOK_HEADERS,
  PHISHING_WEBHOOK_SECRET_MIN_LENGTH,
} from "../constants/phishing.constants";

import type { SignedPhishingRequest } from "../types/phishing.types";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";

export function verifyPhishingSignature(
  rawBody: Buffer,
  secret: string,
  timestamp: string,
  signature: string,
  now = Date.now(),
): boolean {
  if (
    secret.length < PHISHING_WEBHOOK_SECRET_MIN_LENGTH ||
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;

  if (Math.abs(now - Number(timestamp) * 1000) > PHISHING_SIGNATURE_MAX_AGE_MS) return false;

  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(rawBody)
    .digest();

  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function hasPhishingBodyWithinLimit(
  request: RawBodyRequest<Request>,
  maxBytes: number,
): request is SignedPhishingRequest {
  return Boolean(request.rawBody) && request.rawBody!.length <= maxBytes;
}

export function isSignedByPhishingPlugin(
  request: SignedPhishingRequest,
  secret: string | undefined,
): boolean {
  if (!secret) return false;

  return verifyPhishingSignature(
    request.rawBody,
    secret,
    String(request.headers[PHISHING_WEBHOOK_HEADERS.TIMESTAMP] ?? ""),
    String(request.headers[PHISHING_WEBHOOK_HEADERS.SIGNATURE] ?? ""),
  );
}
