import { AiCapabilityProvider } from "@mentingo/luma-sdk";
import { Value } from "@sinclair/typebox/value";

import { voiceTtsProviderSchema } from "./env.schema";
import { resolveVoiceTtsProvider } from "./voice-tts-provider";

describe("voice reference vendor", () => {
  it.each(["cartesia", "elevenlabs"] as const)("exposes the configured %s vendor", (vendor) => {
    const result = resolveVoiceTtsProvider({
      enabled: true,
      provider: AiCapabilityProvider.MentingoCore,
      vendor,
    });

    expect(result).toBe(vendor);
    expect(Value.Check(voiceTtsProviderSchema, result)).toBe(true);
  });

  it("preserves custom endpoint routing even when a vendor value is present", () => {
    expect(
      resolveVoiceTtsProvider({
        enabled: true,
        provider: AiCapabilityProvider.Luma,
        vendor: "elevenlabs",
      }),
    ).toBe("openaiCompatible");
  });

  it("keeps Cartesia for older configurations without vendor metadata", () => {
    expect(
      resolveVoiceTtsProvider({ enabled: true, provider: AiCapabilityProvider.MentingoCore }),
    ).toBe("cartesia");
    expect(resolveVoiceTtsProvider(undefined)).toBe("cartesia");
  });

  it("does not interpret an unknown core vendor as ElevenLabs", () => {
    expect(
      resolveVoiceTtsProvider({
        enabled: true,
        provider: AiCapabilityProvider.MentingoCore,
        vendor: "unknown",
      }),
    ).toBe("cartesia");
  });
});
