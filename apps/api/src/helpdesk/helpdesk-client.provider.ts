import { createGuideClient } from "@mentingo/guide-sdk";

import { HELPDESK_TIMEOUT_MS } from "./helpdesk.types";

import type { HelpdeskSdkClient } from "./helpdesk.types";
import type { HelpdeskConfig } from "src/common/configuration/helpdesk";

/** Constructing the client performs no request and never reads an API key. */
export function createHelpdeskSdkClient(config: HelpdeskConfig): HelpdeskSdkClient | null {
  if (!config.enabled) return null;

  const { search, tutorials } = createGuideClient({
    baseURL: config.baseURL,
    timeoutMs: HELPDESK_TIMEOUT_MS,
  });
  return { search, tutorials };
}
