import { VOICE_CAPTURE_PROFILE } from "@repo/shared";

import { AUDIO_CAPTURE_MODE, type AudioCaptureMode } from "./audio-stream.types";

export function resolveAudioCaptureMode(
  payload: unknown,
  fallback: AudioCaptureMode,
): AudioCaptureMode {
  const captureProfile = readString(payload, "transcriptionSessionPlan", "captureProfile");

  if (captureProfile === VOICE_CAPTURE_PROFILE.CONTINUOUS_PCM) {
    return AUDIO_CAPTURE_MODE.CONTINUOUS;
  }

  if (captureProfile === VOICE_CAPTURE_PROFILE.VAD_SEGMENTED) {
    return AUDIO_CAPTURE_MODE.VAD_SEGMENTED;
  }

  return fallback;
}

function readString(payload: unknown, ...path: string[]): string | null {
  let current: unknown = payload;
  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }

  return typeof current === "string" && current.length > 0 ? current : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
