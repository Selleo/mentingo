import {
  VOICE_CAPTURE_PROFILE,
  VOICE_ENDPOINTING_MODE,
  type AudioStartedPayload,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import { resolveVoiceEndpointingMode } from "./audio-capture-mode";

describe("resolveVoiceEndpointingMode", () => {
  it("uses client VAD when the backend assigns client-owned boundaries", () => {
    expect(
      resolveVoiceEndpointingMode(
        {
          transcriptionSessionPlan: {
            boundarySource: VOICE_ENDPOINTING_MODE.CLIENT_VAD,
          },
        },
        VOICE_ENDPOINTING_MODE.PROVIDER,
      ),
    ).toBe(VOICE_ENDPOINTING_MODE.CLIENT_VAD);
  });

  it("uses provider endpointing when the backend assigns provider-owned boundaries", () => {
    expect(
      resolveVoiceEndpointingMode(
        {
          transcriptionSessionPlan: {
            boundarySource: VOICE_ENDPOINTING_MODE.PROVIDER,
          },
        },
        VOICE_ENDPOINTING_MODE.CLIENT_VAD,
      ),
    ).toBe(VOICE_ENDPOINTING_MODE.PROVIDER);
  });

  it("supports legacy capture profiles when boundary ownership is absent", () => {
    const captureProfile: AudioStartedPayload["transcriptionSessionPlan"]["captureProfile"] =
      VOICE_CAPTURE_PROFILE.VAD_SEGMENTED;

    expect(
      resolveVoiceEndpointingMode(
        { transcriptionSessionPlan: { captureProfile } },
        VOICE_ENDPOINTING_MODE.PROVIDER,
      ),
    ).toBe(VOICE_ENDPOINTING_MODE.CLIENT_VAD);
  });

  it("keeps the fallback when no endpointing contract is present", () => {
    expect(
      resolveVoiceEndpointingMode(
        { transcriptionSessionPlan: { providerAdapter: "unknown" } },
        VOICE_ENDPOINTING_MODE.CLIENT_VAD,
      ),
    ).toBe(VOICE_ENDPOINTING_MODE.CLIENT_VAD);
  });
});
