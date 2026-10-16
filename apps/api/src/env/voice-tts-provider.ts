import { AiCapabilityProvider, type AiCapabilityStatus } from "@mentingo/luma-sdk";

import type { VoiceTtsProvider } from "./env.schema";

/** Read the optional vendor while remaining compatible with older Luma configurations. */
export function resolveVoiceTtsProvider(
  capability: (Pick<AiCapabilityStatus, "enabled" | "provider"> & { vendor?: unknown }) | undefined,
): VoiceTtsProvider {
  if (capability?.enabled && capability.provider === AiCapabilityProvider.Luma) {
    return "openaiCompatible";
  }

  if (
    capability?.provider === AiCapabilityProvider.MentingoCore &&
    capability.vendor === "elevenlabs"
  ) {
    return "elevenlabs";
  }

  return "cartesia";
}
