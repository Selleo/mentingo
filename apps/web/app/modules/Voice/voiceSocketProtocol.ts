import {
  VOICE_SOCKET_EVENT,
  type VoiceAction,
  type PcmChunkMeta,
  type StreamInitPayload,
} from "@repo/shared";

import type { SocketEmitSpec, StreamProtocol } from "./audio-stream";

export type VoiceStartContext = {
  voiceAction: VoiceAction;
  metadata?: Record<string, unknown>;
};

const buildVoiceStartEmit = (params: {
  init: StreamInitPayload;
  context: VoiceStartContext;
}): SocketEmitSpec => ({
  event: VOICE_SOCKET_EVENT.START_AUDIO,
  args: [
    {
      voiceAction: params.context.voiceAction,
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

export const voiceSocketProtocol: StreamProtocol<VoiceStartContext, void> = {
  buildStartEmit: buildVoiceStartEmit,
  buildChunkEmit: buildVoiceChunkEmit,
  buildStopEmit: buildVoiceStopEmit,
  buildCancelEmit: buildVoiceCancelEmit,
};
