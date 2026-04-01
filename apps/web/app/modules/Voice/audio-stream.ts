import { MicVAD } from "@ricky0123/vad-web";

import { acquireSocket, releaseSocket } from "~/api/socket";

import type { PcmChunkMeta, StreamInitPayload } from "@repo/shared";
import type { Socket } from "socket.io-client";

export type SocketEmitSpec = {
  event: string;
  args: unknown[];
  expectAck?: boolean;
  ackTimeoutMs?: number;
};

export type StreamProtocol<TStartContext = void, TStopContext = void> = {
  buildStartEmit: (params: { init: StreamInitPayload; context: TStartContext }) => SocketEmitSpec;
  buildChunkEmit: (params: { chunkMeta: PcmChunkMeta; chunkBuffer: ArrayBuffer }) => SocketEmitSpec;
  buildStopEmit: (params: { lastSeq: number; context?: TStopContext }) => SocketEmitSpec;
  buildCancelEmit: () => SocketEmitSpec;
};

const VAD_WEB_VERSION = "0.0.30";
const ONNX_RUNTIME_WEB_VERSION = "1.24.3";
const VAD_ASSET_BASE_PATH = `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_WEB_VERSION}/dist/`;
const ONNX_WASM_BASE_PATH = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/`;

export class RealtimePCMStreamerWorklet {
  private readonly protocol: StreamProtocol<unknown, unknown>;
  private socket: Socket | null = null;
  private micVad: MicVAD | null = null;
  private readonly onLevelChange?: (level: number) => void;
  private readonly onChunkSent?: (meta: PcmChunkMeta) => void;

  private readonly targetSr = 16000;
  private readonly chunkMs = 32;
  private readonly channels = 1;
  private readonly chunkSamples = (this.targetSr * this.chunkMs) / 1000;

  private seq = 0;
  private pendingSamples: number[] = [];
  private preSpeechSamples: number[] = [];
  private isSpeaking = false;
  private readonly preSpeechMaxSamples = this.targetSr * 0.3;
  private readonly onSocketConnect = () => {
    this.emitReadyChunks();
  };
  private readonly onSessionMetadataCleared = () => {
    this.seq = 0;
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
  };

  constructor(
    protocol: StreamProtocol<unknown, unknown>,
    onLevelChange?: (level: number) => void,
    onChunkSent?: (meta: PcmChunkMeta) => void,
  ) {
    this.protocol = protocol;
    this.onLevelChange = onLevelChange;
    this.onChunkSent = onChunkSent;
  }

  async start<TStartContext>(context: TStartContext) {
    this.socket = acquireSocket();

    this.socket.on("connect", this.onSocketConnect);
    this.socket.on("voice:sessionMetadataCleared", this.onSessionMetadataCleared);

    this.socket.connect();

    this.seq = 0;
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;

    if (!this.micVad) {
      this.micVad = await MicVAD.new({
        model: "v5",
        startOnLoad: false,
        submitUserSpeechOnPause: true,
        positiveSpeechThreshold: 0.52,
        negativeSpeechThreshold: 0.35,
        minSpeechMs: 260,
        redemptionMs: 800,
        preSpeechPadMs: 120,
        baseAssetPath: VAD_ASSET_BASE_PATH,
        onnxWASMBasePath: ONNX_WASM_BASE_PATH,
        getStream: async () => {
          return await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
            },
            video: false,
          });
        },
        onFrameProcessed: (probabilities, frame) => {
          const level = Number(probabilities.isSpeech) || 0;
          this.onLevelChange?.(Math.max(0, Math.min(1, level)));

          const pcm16Frame = float32ToPcm16(frame);
          if (pcm16Frame.length > 0) {
            this.preSpeechSamples.push(...pcm16Frame);
            if (this.preSpeechSamples.length > this.preSpeechMaxSamples) {
              this.preSpeechSamples.splice(
                0,
                this.preSpeechSamples.length - this.preSpeechMaxSamples,
              );
            }
          }

          if (!this.isSpeaking) {
            return;
          }

          if (pcm16Frame.length > 0) {
            this.pendingSamples.push(...pcm16Frame);
          }

          this.emitReadyChunks();
        },
        onSpeechStart: () => undefined,
        onSpeechRealStart: () => {
          this.isSpeaking = true;
          if (this.preSpeechSamples.length > 0) {
            this.pendingSamples.push(...this.preSpeechSamples);
            this.preSpeechSamples = [];
            this.emitReadyChunks();
          }
        },
        onSpeechEnd: () => {
          this.isSpeaking = false;
          this.preSpeechSamples = [];
          if (this.socket?.connected) {
            this.emitReadyChunks();
            this.pendingSamples = [];
          }
        },
        onVADMisfire: () => {
          this.isSpeaking = false;
          this.pendingSamples = [];
          this.preSpeechSamples = [];
        },
      });
    }

    const startPayload: StreamInitPayload = {
      sr: this.targetSr,
      channels: this.channels,
      format: "pcm_s16le",
    };

    const startEmit = this.protocol.buildStartEmit({
      init: startPayload,
      context,
    });
    this.socket.emit(startEmit.event, ...startEmit.args);

    await this.micVad.start();
  }

  async stop<TStopContext>(context?: TStopContext): Promise<unknown | null> {
    let ackPayload: unknown | null = null;
    const stopEmit = this.protocol.buildStopEmit({
      lastSeq: this.seq - 1,
      context,
    });

    if (this.socket?.connected) {
      try {
        if (stopEmit.expectAck) {
          ackPayload = await this.socket
            .timeout(stopEmit.ackTimeoutMs ?? 10000)
            .emitWithAck(stopEmit.event, ...stopEmit.args);
        } else {
          this.socket.emit(stopEmit.event, ...stopEmit.args);
        }
      } catch {
        this.socket.emit(stopEmit.event, ...stopEmit.args);
      }
    } else {
      this.socket?.emit(stopEmit.event, ...stopEmit.args);
    }

    await this.cleanup();

    return ackPayload;
  }

  async cancel(): Promise<void> {
    const cancelEmit = this.protocol.buildCancelEmit();

    if (this.socket?.connected) {
      this.socket.emit(cancelEmit.event, ...cancelEmit.args);
    }

    await this.cleanup();
  }

  private async cleanup() {
    releaseSocket();

    this.socket?.off("connect", this.onSocketConnect);
    this.socket?.off("voice:sessionMetadataCleared", this.onSessionMetadataCleared);
    this.socket = null;
    this.seq = 0;
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;

    if (this.micVad) {
      await this.micVad.destroy().catch(() => undefined);
      this.micVad = null;
    }
  }

  private emitReadyChunks() {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    while (this.pendingSamples.length >= this.chunkSamples) {
      const chunkSlice = this.pendingSamples.splice(0, this.chunkSamples);
      const chunkBuffer = copyToArrayBuffer(Int16Array.from(chunkSlice));

      const meta: PcmChunkMeta = {
        seq: this.seq++,
        sr: this.targetSr,
        samples: this.chunkSamples,
        ts_ms: performance.now(),
      };

      const chunkEmit = this.protocol.buildChunkEmit({
        chunkMeta: meta,
        chunkBuffer,
      });

      this.socket.emit(chunkEmit.event, ...chunkEmit.args);
      this.onChunkSent?.(meta);
    }
  }
}

function float32ToPcm16(audio: Float32Array): Int16Array {
  const out = new Int16Array(audio.length);

  for (let i = 0; i < audio.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, audio[i]));
    out[i] = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
  }

  return out;
}

function copyToArrayBuffer(samples: Int16Array): ArrayBuffer {
  const copy = new Int16Array(samples.length);
  copy.set(samples);
  return copy.buffer;
}
