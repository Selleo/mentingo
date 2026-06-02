import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";

import {
  onVoiceMentorAudioChunk,
  onVoiceMentorAudioCompleted,
  shouldHandleVoiceMentorInterrupted,
} from "./voiceMentorTurnState";

import type { VoiceMentorTurnState } from "./voiceMentorTurnState";
import type { RealtimePCMPlayer } from "../audio-player";
import type {
  AudioOutputLifecycleEventPayload,
  AudioSpeechEventPayload,
  MentorResponseCompletedEventPayload,
  MentorTranscriptionEventPayload,
  StopAudioEventPayload,
} from "@repo/shared";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type VoiceMentorSocketHandlerDependencies = {
  setInput: Dispatch<SetStateAction<string>>;
  stopCaptureFromServer: () => Promise<void>;
  showErrorToast: (translationKey: string) => void;
  audioPlayerRef: MutableRefObject<RealtimePCMPlayer | null>;
  turnStateRef: MutableRefObject<VoiceMentorTurnState>;
  clearTurnState: () => void;
  restartInactivityTimer: () => void;
  clearInactivityTimer: () => void;
  finalizeTurnIfReady: () => void;
  onAudioChunkReceived?: () => void;
  onMentorTranscription?: (text: string) => void;
  onMentorResponseCompleted?: (text: string) => void;
  onAudioStarted?: () => void;
  onAudioInterrupted?: () => void;
};

type SocketEventHandlerMap = {
  [VOICE_SOCKET_EVENT.AUDIO_STARTED]: () => void;
  [VOICE_SOCKET_EVENT.STOP_AUDIO]: (payload: StopAudioEventPayload) => void;
  [VOICE_SOCKET_EVENT.AUDIO_SPEECH]: (payload: AudioSpeechEventPayload) => Promise<void>;
  [VOICE_SOCKET_EVENT.MENTOR_TRANSCRIPTION]: (payload: MentorTranscriptionEventPayload) => void;
  [VOICE_SOCKET_EVENT.MENTOR_RESPONSE_COMPLETED]: (
    payload: MentorResponseCompletedEventPayload,
  ) => void;
  [VOICE_SOCKET_EVENT.AUDIO_INTERRUPTED]: (payload: AudioOutputLifecycleEventPayload) => void;
  [VOICE_SOCKET_EVENT.AUDIO_OUTPUT_COMPLETED]: (payload: AudioOutputLifecycleEventPayload) => void;
};

export const SUPPORTED_VOICE_MENTOR_SOCKET_EVENTS = [
  VOICE_SOCKET_EVENT.AUDIO_STARTED,
  VOICE_SOCKET_EVENT.STOP_AUDIO,
  VOICE_SOCKET_EVENT.AUDIO_SPEECH,
  VOICE_SOCKET_EVENT.MENTOR_TRANSCRIPTION,
  VOICE_SOCKET_EVENT.MENTOR_RESPONSE_COMPLETED,
  VOICE_SOCKET_EVENT.AUDIO_INTERRUPTED,
  VOICE_SOCKET_EVENT.AUDIO_OUTPUT_COMPLETED,
] as const;

export function createVoiceMentorSocketHandlers({
  setInput,
  stopCaptureFromServer,
  showErrorToast,
  audioPlayerRef,
  turnStateRef,
  clearTurnState,
  restartInactivityTimer,
  clearInactivityTimer,
  finalizeTurnIfReady,
  onAudioChunkReceived,
  onMentorTranscription,
  onMentorResponseCompleted,
  onAudioStarted,
  onAudioInterrupted,
}: VoiceMentorSocketHandlerDependencies): SocketEventHandlerMap {
  return {
    [VOICE_SOCKET_EVENT.AUDIO_STARTED]: () => {
      onAudioStarted?.();
    },
    [VOICE_SOCKET_EVENT.STOP_AUDIO]: (data) => {
      if (data?.voiceAction !== VOICE_ACTION.VOICE_MENTOR) {
        return;
      }

      void stopCaptureFromServer().catch(() => undefined);

      if (data.translationKey) {
        showErrorToast(data.translationKey);
        return;
      }

      const payload = data.payload;
      if (typeof payload === "string" && payload.length > 0) {
        setInput((prev) => prev + payload);
      }
    },
    [VOICE_SOCKET_EVENT.AUDIO_SPEECH]: async (data) => {
      if (typeof data.seq !== "number" || typeof data.turnId !== "string" || !data.turnId) {
        return;
      }

      const nextState = onVoiceMentorAudioChunk(turnStateRef.current, {
        turnId: data.turnId,
        seq: data.seq,
        nowMs: Date.now(),
      });
      if (!nextState.accept) {
        return;
      }

      if (nextState.hardCut) {
        audioPlayerRef.current?.reset();
      }

      turnStateRef.current = nextState.nextState;
      const bytes = decodeBase64ToBytes(data.chunkBase64);
      if (bytes.length === 0) {
        return;
      }

      await audioPlayerRef.current?.enqueue(bytes);
      onAudioChunkReceived?.();
      restartInactivityTimer();
    },
    [VOICE_SOCKET_EVENT.MENTOR_TRANSCRIPTION]: (payload) => {
      const text = payload.text?.trim();
      if (!text) {
        return;
      }

      onMentorTranscription?.(text);
    },
    [VOICE_SOCKET_EVENT.MENTOR_RESPONSE_COMPLETED]: (payload) => {
      if (payload.reason !== "complete") {
        return;
      }

      const text = payload.text?.trim();
      if (!text) {
        return;
      }

      onMentorResponseCompleted?.(text);
    },
    [VOICE_SOCKET_EVENT.AUDIO_INTERRUPTED]: (payload) => {
      const turnId = payload?.turnId;
      if (!shouldHandleVoiceMentorInterrupted(turnStateRef.current, turnId)) {
        return;
      }

      audioPlayerRef.current?.reset();
      clearInactivityTimer();
      clearTurnState();
      onAudioInterrupted?.();
    },
    [VOICE_SOCKET_EVENT.AUDIO_OUTPUT_COMPLETED]: (payload) => {
      const turnId = payload?.turnId;
      turnStateRef.current = onVoiceMentorAudioCompleted(turnStateRef.current, turnId);
      finalizeTurnIfReady();
    },
  };
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  if (!base64) {
    return new Uint8Array(0);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
