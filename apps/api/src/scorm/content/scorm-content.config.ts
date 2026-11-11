import { Logger, ServiceUnavailableException } from "@nestjs/common";

import { Environment, environmentValidation } from "src/utils/environment-validation";

import {
  SCORM_CONTENT_CONFIG,
  SCORM_CONTENT_CONFIG_ERRORS,
  SCORM_CONTENT_ERROR_KEYS,
} from "./scorm-content.constants";

import type { Request } from "express";

const logger = new Logger("ScormContentConfig");

/** Logs the operator-facing configuration problem and fails with a translated, user-facing error. */
function failMisconfiguredScormContent(reason: string): never {
  logger.error(reason);
  throw new ServiceUnavailableException(SCORM_CONTENT_ERROR_KEYS.UNAVAILABLE);
}

function parseHttpsOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value ? url : null;
  } catch {
    return null;
  }
}

function getScormContentUrl(): URL {
  const configuredOrigin = process.env.SCORM_CONTENT_ORIGIN;

  if (!configuredOrigin && isScormLocalEnvironment()) {
    return new URL(SCORM_CONTENT_CONFIG.LOCAL_ORIGIN);
  }
  if (!configuredOrigin) failMisconfiguredScormContent(SCORM_CONTENT_CONFIG_ERRORS.MISSING_ORIGIN);

  return (
    parseHttpsOrigin(configuredOrigin) ??
    failMisconfiguredScormContent(SCORM_CONTENT_CONFIG_ERRORS.INVALID_ORIGIN)
  );
}

export function isScormLocalEnvironment(): boolean {
  return environmentValidation(process.env.NODE_ENV ?? "") === Environment.DEVELOPMENT;
}

export function isScormContentHost(request: Request): boolean {
  return request.headers.host === getScormContentUrl().host;
}

export function getScormContentOrigin(): string {
  return getScormContentUrl().origin;
}

export function assertScormContentOriginConfigured(): void {
  getScormContentUrl();
}
