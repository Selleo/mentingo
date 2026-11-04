import { SCORM_PLAYER_ATTRIBUTES } from "@repo/shared";

import {
  SCORM_CONTENT_CSP,
  SCORM_CONTENT_REPORT_ONLY_CSP,
  SCORM_CONTENT_RESPONSE_POLICY,
} from "./scorm-content.constants";

import type { Response } from "express";

/**
 * Enforces sandboxing, framing and form/object restrictions; resource and network directives
 * stay report-only so vendor packages that load external resources keep working.
 */
export function setScormContentHeaders(response: Response, parentOrigin: string) {
  response.setHeader("Cache-Control", SCORM_CONTENT_RESPONSE_POLICY.CACHE_CONTROL);
  response.setHeader("Referrer-Policy", SCORM_PLAYER_ATTRIBUTES.REFERRER_POLICY);
  response.setHeader("X-Content-Type-Options", SCORM_CONTENT_RESPONSE_POLICY.CONTENT_TYPE_OPTIONS);
  response.setHeader("Permissions-Policy", SCORM_CONTENT_RESPONSE_POLICY.PERMISSIONS_POLICY);
  response.setHeader(
    "Content-Security-Policy",
    [
      `sandbox ${SCORM_PLAYER_ATTRIBUTES.SANDBOX}`,
      `frame-ancestors ${parentOrigin} 'self'`,
      ...Object.values(SCORM_CONTENT_CSP),
    ].join("; "),
  );
  response.setHeader(
    "Content-Security-Policy-Report-Only",
    Object.values(SCORM_CONTENT_REPORT_ONLY_CSP).join("; "),
  );
}
