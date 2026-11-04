import type { createGuideClient } from "@mentingo/guide-sdk";
import type { ConfigType } from "@nestjs/config";
import type helpdeskConfig from "src/common/configuration/self-onboarding";

export type HelpdeskConfig = ConfigType<typeof helpdeskConfig>;

/** Only the public SDK surface is available to the Core integration. */
export type HelpdeskSdkClient = Pick<ReturnType<typeof createGuideClient>, "search" | "tutorials">;

export const HELPDESK_CLIENT = Symbol("HELPDESK_CLIENT");
export const HELPDESK_TIMEOUT_MS = 5_000;
