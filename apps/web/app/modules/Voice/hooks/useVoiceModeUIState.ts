import { VOICE_MODE_STATE } from "@repo/shared";
import { useCallback, useReducer } from "react";

import type { VoiceModeState } from "@repo/shared";

type VoiceModeUIEvent =
  | { type: "MIC_CAPTURE_STARTED" }
  | { type: "MIC_CAPTURE_STOPPED" }
  | { type: "USER_SPEECH_CHUNK_SENT" }
  | { type: "MENTOR_TRANSCRIPTION_RECEIVED" }
  | { type: "AUDIO_CHUNK_RECEIVED" }
  | { type: "AUDIO_OUTPUT_COMPLETED"; isCaptureActive: boolean }
  | { type: "AUDIO_INTERRUPTED"; isCaptureActive: boolean };

function voiceModeUIReducer(state: VoiceModeState, event: VoiceModeUIEvent): VoiceModeState {
  switch (event.type) {
    case "MIC_CAPTURE_STARTED":
    case "USER_SPEECH_CHUNK_SENT":
      return VOICE_MODE_STATE.LISTENING;
    case "MENTOR_TRANSCRIPTION_RECEIVED":
      return VOICE_MODE_STATE.THINKING;
    case "AUDIO_CHUNK_RECEIVED":
      return VOICE_MODE_STATE.SPEAKING;
    case "AUDIO_OUTPUT_COMPLETED":
    case "AUDIO_INTERRUPTED":
      return event.isCaptureActive ? VOICE_MODE_STATE.LISTENING : VOICE_MODE_STATE.IDLE;
    case "MIC_CAPTURE_STOPPED":
      return VOICE_MODE_STATE.IDLE;
    default:
      return state;
  }
}

export function useVoiceModeUIState() {
  const [voiceModeState, dispatch] = useReducer(voiceModeUIReducer, VOICE_MODE_STATE.IDLE);

  const onMicCaptureStarted = useCallback(() => {
    dispatch({ type: "MIC_CAPTURE_STARTED" });
  }, []);

  const onMicCaptureStopped = useCallback(() => {
    dispatch({ type: "MIC_CAPTURE_STOPPED" });
  }, []);

  const onUserSpeechChunkSent = useCallback(() => {
    dispatch({ type: "USER_SPEECH_CHUNK_SENT" });
  }, []);

  const onMentorTranscriptionReceived = useCallback(() => {
    dispatch({ type: "MENTOR_TRANSCRIPTION_RECEIVED" });
  }, []);

  const onAudioChunkReceived = useCallback(() => {
    dispatch({ type: "AUDIO_CHUNK_RECEIVED" });
  }, []);

  const onAudioOutputCompleted = useCallback((isCaptureActive: boolean) => {
    dispatch({ type: "AUDIO_OUTPUT_COMPLETED", isCaptureActive });
  }, []);

  const onAudioInterrupted = useCallback((isCaptureActive: boolean) => {
    dispatch({ type: "AUDIO_INTERRUPTED", isCaptureActive });
  }, []);

  return {
    voiceModeState,
    onMicCaptureStarted,
    onMicCaptureStopped,
    onUserSpeechChunkSent,
    onMentorTranscriptionReceived,
    onAudioChunkReceived,
    onAudioOutputCompleted,
    onAudioInterrupted,
  };
}
