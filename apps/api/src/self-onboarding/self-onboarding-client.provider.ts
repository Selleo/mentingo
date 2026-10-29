import { createGuideClient } from "@mentingo/guide-sdk";

import { HELPDESK_TIMEOUT_MS } from "./self-onboarding.types";

import type { HelpdeskSdkClient } from "./self-onboarding.types";
import type { HelpdeskConfig } from "src/common/configuration/self-onboarding";

/** Constructing the client performs no request and never reads an API key. */
export function createHelpdeskSdkClient(config: HelpdeskConfig): HelpdeskSdkClient | null {
  if (!config.enabled) return null;

  const { search, tutorials } = createGuideClient({
    baseURL: config.baseURL,
    timeoutMs: HELPDESK_TIMEOUT_MS,
  });
  return { search, tutorials };
}
