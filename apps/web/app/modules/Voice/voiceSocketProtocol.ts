import {
  VOICE_SOCKET_EVENT,
  type VoiceAction,
  type PcmChunkMeta,
  type StreamInitPayload,
} from "@repo/shared";

import type { SocketEmitSpec, StreamProtocol } from "./audio-stream";
import {
  AUDIO_CAPTURE_MODE,
  AUDIO_STREAM_EVENT,
  AUDIO_STREAM_MESSAGE_TYPE,
  type AudioCaptureMode,
} from "./audio-stream.types";

export type VoiceStartContext = {
  voiceAction: VoiceAction;
  lessonId?: string;
  metadata?: Record<string, unknown>;
  captureMode?: AudioCaptureMode;
};

const buildVoiceStartEmit = (params: {
  init: StreamInitPayload;
  context: VoiceStartContext;
}): SocketEmitSpec => ({
  event: VOICE_SOCKET_EVENT.START_AUDIO,
  args: [
    {
      voiceAction: params.context.voiceAction,
      ...(params.context.lessonId ? { lessonId: params.context.lessonId } : {}),
      meta: params.init,
      ...(params.context.metadata ? { metadata: params.context.metadata } : {}),
    },
  ],
});

const buildVoiceChunkEmit = (params: {
  chunkMeta: PcmChunkMeta;
  chunkBuffer: ArrayBuffer;
}): SocketEmitSpec => ({
  event: VOICE_SOCKET_EVENT.AUDIO_CHUNK,
  args: [{ meta: params.chunkMeta, bytes: params.chunkBuffer }],
});

const buildVoiceStopEmit = (params: { lastSeq: number; context?: void }): SocketEmitSpec => ({
  event: VOICE_SOCKET_EVENT.STOP_AUDIO,
  args: [{ lastSeq: params.lastSeq }],
  expectAck: false,
});

const buildVoiceCancelEmit = (): SocketEmitSpec => ({
  event: VOICE_SOCKET_EVENT.CANCEL_AUDIO,
  args: [],
});

const buildVoiceReconnectEmit = (params: {
  sessionRunId: string;
  lastSentAudioSeq: number;
  attempt: number;
}): SocketEmitSpec => ({
  event: AUDIO_STREAM_EVENT.RECONNECT,
  args: [
    {
      type: AUDIO_STREAM_MESSAGE_TYPE.RECONNECT,
      sessionRunId: params.sessionRunId,
      lastSentAudioSeq: Math.max(0, params.lastSentAudioSeq),
      attempt: params.attempt,
    },
  ],
});

export const voiceSocketProtocol: StreamProtocol<VoiceStartContext, void> = {
  buildStartEmit: buildVoiceStartEmit,
  buildChunkEmit: buildVoiceChunkEmit,
  buildStopEmit: buildVoiceStopEmit,
  buildCancelEmit: buildVoiceCancelEmit,
  resolveCaptureMode: (context) =>
    context.captureMode ??
    (context.voiceAction === VOICE_ACTION.VOICE_MENTOR
      ? AUDIO_CAPTURE_MODE.CONTINUOUS
      : AUDIO_CAPTURE_MODE.VAD_SEGMENTED),
  buildReconnectEmit: buildVoiceReconnectEmit,
  lifecycleEvents: {
    startAccepted: AUDIO_STREAM_EVENT.START_ACCEPTED,
    recovered: AUDIO_STREAM_EVENT.RECOVERED,
    reconnectError: AUDIO_STREAM_EVENT.RECONNECT_ERROR,
    chunkAccepted: AUDIO_STREAM_EVENT.CHUNK_ACCEPTED,
    chunkError: AUDIO_STREAM_EVENT.CHUNK_ERROR,
  },
};
