import {
  VOICE_CAPTURE_PROFILE,
  VOICE_ENDPOINTING_MODE,
  type VoiceEndpointingMode,
} from "@repo/shared";

import { readString } from "./audio-utils";

export function resolveVoiceEndpointingMode(
  payload: unknown,
  fallback: VoiceEndpointingMode,
): VoiceEndpointingMode {
  const boundarySource = readString(payload, "transcriptionSessionPlan", "boundarySource");

  if (boundarySource === VOICE_ENDPOINTING_MODE.CLIENT_VAD) {
    return VOICE_ENDPOINTING_MODE.CLIENT_VAD;
  }

  if (boundarySource === VOICE_ENDPOINTING_MODE.PROVIDER) {
    return VOICE_ENDPOINTING_MODE.PROVIDER;
  }

  const captureProfile = readString(payload, "transcriptionSessionPlan", "captureProfile");
  if (captureProfile === VOICE_CAPTURE_PROFILE.VAD_SEGMENTED) {
    return VOICE_ENDPOINTING_MODE.CLIENT_VAD;
  }

  if (captureProfile === VOICE_CAPTURE_PROFILE.CONTINUOUS_PCM) {
    return VOICE_ENDPOINTING_MODE.PROVIDER;
  }

  return fallback;
}
