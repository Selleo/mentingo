import { VOICE_MODE_STATE } from "@repo/shared";
import { useCallback, useReducer } from "react";

import type { VoiceModeState } from "@repo/shared";

type VoiceModeUIEvent =
  | { type: "MIC_CAPTURE_STARTED" }
  | { type: "MIC_CAPTURE_STOPPED" }
  | { type: "USER_SPEECH_CHUNK_SENT" }
  | { type: "LEARNER_TRANSCRIPTION_RECEIVED" }
  | { type: "AUDIO_PLAYBACK_STARTED" }
  | { type: "AUDIO_OUTPUT_COMPLETED"; isCaptureActive: boolean }
  | { type: "AUDIO_INTERRUPTED"; isCaptureActive: boolean };

function voiceModeUIReducer(state: VoiceModeState, event: VoiceModeUIEvent): VoiceModeState {
  switch (event.type) {
    case "MIC_CAPTURE_STARTED":
    case "USER_SPEECH_CHUNK_SENT":
      return VOICE_MODE_STATE.LISTENING;
    case "LEARNER_TRANSCRIPTION_RECEIVED":
      return VOICE_MODE_STATE.THINKING;
    case "AUDIO_PLAYBACK_STARTED":
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

  const onLearnerTranscriptionReceived = useCallback(() => {
    dispatch({ type: "LEARNER_TRANSCRIPTION_RECEIVED" });
  }, []);

  const onAudioPlaybackStarted = useCallback(() => {
    dispatch({ type: "AUDIO_PLAYBACK_STARTED" });
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
    onLearnerTranscriptionReceived,
    onAudioPlaybackStarted,
    onAudioOutputCompleted,
    onAudioInterrupted,
  };
}
