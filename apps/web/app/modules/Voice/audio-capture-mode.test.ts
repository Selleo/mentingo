import { VOICE_CAPTURE_PROFILE, type AudioStartedPayload } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { resolveAudioCaptureMode } from "./audio-capture-mode";
import { AUDIO_CAPTURE_MODE } from "./audio-stream.types";

describe("resolveAudioCaptureMode", () => {
  it("maps the backend continuous PCM profile to continuous capture", () => {
    const captureProfile: AudioStartedPayload["transcriptionSessionPlan"]["captureProfile"] =
      VOICE_CAPTURE_PROFILE.CONTINUOUS_PCM;

    expect(
      resolveAudioCaptureMode(
        { transcriptionSessionPlan: { captureProfile } },
        AUDIO_CAPTURE_MODE.VAD_SEGMENTED,
      ),
    ).toBe(AUDIO_CAPTURE_MODE.CONTINUOUS);
  });

  it("keeps VAD segmented capture for the segmented profile", () => {
    const captureProfile: AudioStartedPayload["transcriptionSessionPlan"]["captureProfile"] =
      VOICE_CAPTURE_PROFILE.VAD_SEGMENTED;

    expect(
      resolveAudioCaptureMode(
        { transcriptionSessionPlan: { captureProfile } },
        AUDIO_CAPTURE_MODE.CONTINUOUS,
      ),
    ).toBe(AUDIO_CAPTURE_MODE.VAD_SEGMENTED);
  });

  it("does not infer capture from transcription mode or provider", () => {
    expect(
      resolveAudioCaptureMode(
        {
          transcriptionSessionPlan: {
            effectiveTranscriptionMode: "realtime_stream",
            providerAdapter: "gladia",
          },
        },
        AUDIO_CAPTURE_MODE.VAD_SEGMENTED,
      ),
    ).toBe(AUDIO_CAPTURE_MODE.VAD_SEGMENTED);
  });
});
