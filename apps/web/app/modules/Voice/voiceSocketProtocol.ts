import {
  VOICE_ACTION,
  VOICE_ENDPOINTING_MODE,
  VOICE_SOCKET_EVENT,
  type ClientSpeechBoundaryPayload,
  type VoiceAction,
  type PcmChunkMeta,
  type StreamInitPayload,
  type VoiceEndpointingMode,
} from "@repo/shared";

import { AUDIO_STREAM_EVENT, AUDIO_STREAM_MESSAGE_TYPE } from "./audio-stream.types";

import type { SocketEmitSpec, StreamProtocol } from "./audio-stream";

export type VoiceStartContext = {
  voiceAction: VoiceAction;
  lessonId?: string;
  metadata?: Record<string, unknown>;
  endpointingMode?: VoiceEndpointingMode;
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

const buildSpeechBoundaryEmit = (params: {
  event: string;
  boundary: ClientSpeechBoundaryPayload;
}): SocketEmitSpec => ({
  event: params.event,
  args: [params.boundary],
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
  buildSpeechStartEmit: ({ boundary }) =>
    buildSpeechBoundaryEmit({
      event: VOICE_SOCKET_EVENT.CLIENT_SPEECH_START,
      boundary,
    }),
  buildSpeechEndEmit: ({ boundary }) =>
    buildSpeechBoundaryEmit({
      event: VOICE_SOCKET_EVENT.CLIENT_SPEECH_END,
      boundary,
    }),
  resolveEndpointingMode: (context) => context.endpointingMode ?? VOICE_ENDPOINTING_MODE.CLIENT_VAD,
  keepsClientVadTurnOpen: (context) => context.voiceAction === VOICE_ACTION.VOICE_MENTOR,
  buildReconnectEmit: buildVoiceReconnectEmit,
  lifecycleEvents: {
    startAccepted: AUDIO_STREAM_EVENT.START_ACCEPTED,
    recoveryStarted: AUDIO_STREAM_EVENT.RECOVERY_STARTED,
    recovered: AUDIO_STREAM_EVENT.RECOVERED,
    reconnectError: AUDIO_STREAM_EVENT.RECONNECT_ERROR,
    chunkAccepted: AUDIO_STREAM_EVENT.CHUNK_ACCEPTED,
    chunkError: AUDIO_STREAM_EVENT.CHUNK_ERROR,
  },
};
