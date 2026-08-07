import { MicVAD } from "@ricky0123/vad-web";

import { acquireSocket, releaseSocket } from "~/api/socket";

import {
  AUDIO_CAPTURE_MODE,
  AUDIO_SESSION_ERROR_CODE,
  TRANSCRIPTION_MODE,
  TRANSCRIPTION_PROVIDER,
  type AudioCaptureMode,
  type AudioReconnectContext,
  type AudioStreamLifecycleEvents,
} from "./audio-stream.types";

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
  resolveCaptureMode?: (context: TStartContext) => AudioCaptureMode;
  buildReconnectEmit?: (context: AudioReconnectContext) => SocketEmitSpec;
  lifecycleEvents?: AudioStreamLifecycleEvents;
};

const VAD_WEB_VERSION = "0.0.30";
const ONNX_RUNTIME_WEB_VERSION = "1.24.3";
const VAD_ASSET_BASE_PATH = `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_WEB_VERSION}/dist/`;
const ONNX_WASM_BASE_PATH = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/`;
const VAD_CONFIG = {
  positiveSpeechThreshold: 0.42,
  negativeSpeechThreshold: 0.24,
  minSpeechMs: 120,
  redemptionMs: 700,
  preSpeechPadMs: 220,
} as const;
const POST_REDEMPTION_EMPTY_AUDIO_MS = VAD_CONFIG.redemptionMs;
const MAX_AUDIO_RECONNECT_ATTEMPTS = 8;
const START_ACCEPT_TIMEOUT_MS = 10000;

export class RealtimePCMStreamerWorklet {
  private readonly protocol: StreamProtocol<unknown, unknown>;
  private socket: Socket | null = null;
  private micVad: MicVAD | null = null;
  private continuousAudioContext: AudioContext | null = null;
  private continuousAudioStream: MediaStream | null = null;
  private continuousAudioSource: MediaStreamAudioSourceNode | null = null;
  private continuousAudioProcessor: ScriptProcessorNode | null = null;
  private readonly onLevelChange?: (level: number) => void;
  private readonly onChunkSent?: (meta: PcmChunkMeta) => void;

  private readonly targetSr = 16000;
  private readonly chunkMs = 32;
  private readonly channels = 1;
  private readonly chunkSamples = (this.targetSr * this.chunkMs) / 1000;
  private readonly preSpeechMaxSamples = (this.targetSr * (VAD_CONFIG.preSpeechPadMs + 120)) / 1000;

  private nextAudioSeq = 0;
  private lastSentAudioSeq = -1;
  private sessionRunId: string | null = null;
  private reconnectAttempt = 0;
  private isSessionActive = false;
  private captureMode: AudioCaptureMode = AUDIO_CAPTURE_MODE.VAD_SEGMENTED;
  private readonly sentChunks = new Map<number, ArrayBuffer>();
  private pendingSamples: number[] = [];
  private preSpeechSamples: number[] = [];
  private isSpeaking = false;
  private hasActiveSpeechSegment = false;
  private isMuted = false;
  private startAcceptedResolve: (() => void) | null = null;
  private startAcceptedReject: ((reason: unknown) => void) | null = null;
  private readonly onSocketConnect = () => {
    if (!this.isSessionActive) {
      return;
    }

    if (this.sessionRunId && this.protocol.buildReconnectEmit) {
      this.reconnectAttempt = Math.min(this.reconnectAttempt + 1, MAX_AUDIO_RECONNECT_ATTEMPTS);
      const reconnectEmit = this.protocol.buildReconnectEmit({
        sessionRunId: this.sessionRunId,
        lastSentAudioSeq: this.lastSentAudioSeq,
        attempt: this.reconnectAttempt,
      });
      this.socket?.emit(reconnectEmit.event, ...reconnectEmit.args);
      return;
    }

    this.emitReadyChunks();
  };
  private readonly onSessionMetadataCleared = () => {
    this.startAcceptedReject?.(new Error("AUDIO_START_CANCELLED"));
    this.startAcceptedResolve = null;
    this.startAcceptedReject = null;
    this.nextAudioSeq = 1;
    this.lastSentAudioSeq = -1;
    this.sessionRunId = null;
    this.reconnectAttempt = 0;
    this.isSessionActive = false;
    this.captureMode = AUDIO_CAPTURE_MODE.VAD_SEGMENTED;
    this.sentChunks.clear();
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.isMuted = false;
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
    this.registerLifecycleHandlers();

    this.nextAudioSeq = 1;
    this.lastSentAudioSeq = -1;
    this.sessionRunId = null;
    this.reconnectAttempt = 0;
    this.isSessionActive = false;
    this.captureMode =
      this.protocol.resolveCaptureMode?.(context) ?? AUDIO_CAPTURE_MODE.VAD_SEGMENTED;
    this.sentChunks.clear();
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;

    this.socket.connect();

    const startPayload: StreamInitPayload = {
      sr: this.targetSr,
      channels: this.channels,
      format: "pcm_s16le",
    };

    const startEmit = this.protocol.buildStartEmit({
      init: startPayload,
      context,
    });
    this.isSessionActive = true;
    const startAccepted = this.waitForStartAccepted();
    this.socket.emit(startEmit.event, ...startEmit.args);

    try {
      await startAccepted;
      if (!this.isSessionActive) {
        return;
      }

      if (this.captureMode === AUDIO_CAPTURE_MODE.CONTINUOUS) {
        await this.startContinuousCapture();
      } else {
        await this.ensureMicVad();
        await this.micVad?.start();
      }
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  private waitForStartAccepted(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.startAcceptedResolve = resolve;
      this.startAcceptedReject = reject;

      const timeout = setTimeout(() => {
        this.startAcceptedResolve = null;
        this.startAcceptedReject = null;
        reject(new Error("AUDIO_START_ACCEPT_TIMEOUT"));
      }, START_ACCEPT_TIMEOUT_MS);

      const resolveOnce = () => {
        clearTimeout(timeout);
        this.startAcceptedResolve = null;
        this.startAcceptedReject = null;
        resolve();
      };
      this.startAcceptedResolve = resolveOnce;
    });
  }

  private async ensureMicVad(): Promise<void> {
    if (this.micVad) {
      return;
    }

    this.micVad = await MicVAD.new({
      model: "v5",
      startOnLoad: false,
      submitUserSpeechOnPause: true,
      positiveSpeechThreshold: VAD_CONFIG.positiveSpeechThreshold,
      negativeSpeechThreshold: VAD_CONFIG.negativeSpeechThreshold,
      minSpeechMs: VAD_CONFIG.minSpeechMs,
      redemptionMs: VAD_CONFIG.redemptionMs,
      preSpeechPadMs: VAD_CONFIG.preSpeechPadMs,
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
        this.onLevelChange?.(this.isMuted ? 0 : Math.max(0, Math.min(1, level)));

        if (this.isMuted) {
          this.pendingSamples = [];
          this.preSpeechSamples = [];
          return;
        }

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
        if (this.captureMode === AUDIO_CAPTURE_MODE.CONTINUOUS || this.isMuted) {
          return;
        }

        this.isSpeaking = true;
        this.hasActiveSpeechSegment = true;
        if (this.preSpeechSamples.length > 0) {
          this.pendingSamples.push(...this.preSpeechSamples);
          this.preSpeechSamples = [];
          this.emitReadyChunks();
        }
      },
      onSpeechEnd: () => {
        if (this.captureMode === AUDIO_CAPTURE_MODE.CONTINUOUS) {
          return;
        }

        this.isSpeaking = false;
        this.preSpeechSamples = [];
        if (!this.isMuted && this.socket?.connected) {
          this.emitSpeechEndBoundary();
        }
        this.hasActiveSpeechSegment = false;
      },
      onVADMisfire: () => {
        if (this.captureMode === AUDIO_CAPTURE_MODE.CONTINUOUS) {
          return;
        }

        this.isSpeaking = false;
        this.pendingSamples = [];
        this.preSpeechSamples = [];
        this.hasActiveSpeechSegment = false;
      },
    });
  }

  async stop<TStopContext>(context?: TStopContext): Promise<unknown | null> {
    let ackPayload: unknown | null = null;
    const stopEmit = this.protocol.buildStopEmit({
      lastSeq: this.lastSentAudioSeq,
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

  async setMuted(isMuted: boolean) {
    this.isMuted = isMuted;
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.onLevelChange?.(0);

    if (this.captureMode === AUDIO_CAPTURE_MODE.CONTINUOUS) {
      return;
    }

    if (!this.micVad) {
      return;
    }

    if (isMuted) {
      await this.micVad.pause?.().catch(() => undefined);
      return;
    }

    await this.micVad.start?.().catch(() => undefined);
  }

  async cancel(): Promise<void> {
    const cancelEmit = this.protocol.buildCancelEmit();

    if (this.socket?.connected) {
      this.socket.emit(cancelEmit.event, ...cancelEmit.args);
    }

    await this.cleanup();
  }

  private async cleanup() {
    this.startAcceptedReject?.(new Error("AUDIO_START_CANCELLED"));
    this.startAcceptedResolve = null;
    this.startAcceptedReject = null;
    releaseSocket();

    this.socket?.off("connect", this.onSocketConnect);
    this.socket?.off("voice:sessionMetadataCleared", this.onSessionMetadataCleared);
    this.unregisterLifecycleHandlers();
    this.socket = null;
    this.nextAudioSeq = 1;
    this.lastSentAudioSeq = -1;
    this.sessionRunId = null;
    this.reconnectAttempt = 0;
    this.isSessionActive = false;
    this.captureMode = AUDIO_CAPTURE_MODE.VAD_SEGMENTED;
    this.sentChunks.clear();
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.isMuted = false;

    if (this.micVad) {
      await this.micVad.destroy().catch(() => undefined);
      this.micVad = null;
    }

    await this.stopContinuousCapture();
  }

  private emitReadyChunks() {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    while (this.pendingSamples.length >= this.chunkSamples) {
      const chunkSlice = this.pendingSamples.splice(0, this.chunkSamples);
      const chunkBuffer = copyToArrayBuffer(Int16Array.from(chunkSlice));

      const meta: PcmChunkMeta = {
        seq: this.nextAudioSeq++,
        sr: this.targetSr,
        samples: this.chunkSamples,
        ts_ms: performance.now(),
      };

      const chunkEmit = this.protocol.buildChunkEmit({
        chunkMeta: meta,
        chunkBuffer,
      });

      this.socket.emit(chunkEmit.event, ...chunkEmit.args);
      this.lastSentAudioSeq = meta.seq;
      this.sentChunks.set(meta.seq, chunkBuffer);
      this.trimSentChunks();
      this.onChunkSent?.(meta);
    }
  }

  private emitSpeechEndBoundary() {
    if (!this.hasActiveSpeechSegment) {
      this.pendingSamples = [];
      return;
    }

    const trailingSilenceSamples = (this.targetSr * POST_REDEMPTION_EMPTY_AUDIO_MS) / 1000;
    const chunkBoundaryPadding =
      (this.chunkSamples - (this.pendingSamples.length % this.chunkSamples)) % this.chunkSamples;

    this.pendingSamples.push(...Array(chunkBoundaryPadding + trailingSilenceSamples).fill(0));
    this.emitReadyChunks();
    this.pendingSamples = [];
  }

  private async startContinuousCapture() {
    if (this.continuousAudioContext) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
      video: false,
    });
    const audioContext = new AudioContext({ sampleRate: this.targetSr });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (this.isMuted) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const frame = resampleAudio(input, event.inputBuffer.sampleRate, this.targetSr);
      this.onLevelChange?.(calculateAudioLevel(frame));
      this.pendingSamples.push(...float32ToPcm16(frame));
      this.emitReadyChunks();
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    this.continuousAudioContext = audioContext;
    this.continuousAudioStream = stream;
    this.continuousAudioSource = source;
    this.continuousAudioProcessor = processor;
  }

  private async stopContinuousCapture() {
    this.continuousAudioProcessor?.disconnect();
    this.continuousAudioSource?.disconnect();
    this.continuousAudioStream?.getTracks().forEach((track) => track.stop());

    if (this.continuousAudioContext && this.continuousAudioContext.state !== "closed") {
      await this.continuousAudioContext.close().catch(() => undefined);
    }

    this.continuousAudioProcessor = null;
    this.continuousAudioSource = null;
    this.continuousAudioStream = null;
    this.continuousAudioContext = null;
  }

  private registerLifecycleHandlers() {
    const events = this.protocol.lifecycleEvents;
    if (!this.socket || !events) {
      return;
    }

    if (events.startAccepted) {
      this.socket.on(events.startAccepted, this.onStartAccepted);
    }
    if (events.recovered) {
      this.socket.on(events.recovered, this.onRecovered);
    }
    if (events.reconnectError) {
      this.socket.on(events.reconnectError, this.onReconnectError);
    }
    if (events.chunkAccepted) {
      this.socket.on(events.chunkAccepted, this.onChunkAccepted);
    }
    if (events.chunkError) {
      this.socket.on(events.chunkError, this.onChunkError);
    }
  }

  private unregisterLifecycleHandlers() {
    const events = this.protocol.lifecycleEvents;
    if (!this.socket || !events) {
      return;
    }

    if (events.startAccepted) {
      this.socket.off(events.startAccepted, this.onStartAccepted);
    }
    if (events.recovered) {
      this.socket.off(events.recovered, this.onRecovered);
    }
    if (events.reconnectError) {
      this.socket.off(events.reconnectError, this.onReconnectError);
    }
    if (events.chunkAccepted) {
      this.socket.off(events.chunkAccepted, this.onChunkAccepted);
    }
    if (events.chunkError) {
      this.socket.off(events.chunkError, this.onChunkError);
    }
  }

  private readonly onStartAccepted = (payload: unknown) => {
    const sessionRunId = readString(payload, "sessionRunId");
    if (sessionRunId) {
      this.sessionRunId = sessionRunId;
      this.reconnectAttempt = 0;
    }

    const nextAudioSeq = readNonNegativeInteger(payload, "nextAudioSeq");
    if (nextAudioSeq !== null && this.lastSentAudioSeq < 0) {
      this.nextAudioSeq = nextAudioSeq;
    }

    const effectiveMode = readString(
      payload,
      "transcriptionSessionPlan",
      "effectiveTranscriptionMode",
    );
    const provider = readString(payload, "transcriptionSessionPlan", "providerAdapter");
    if (
      effectiveMode === TRANSCRIPTION_MODE.REALTIME_STREAM ||
      provider === TRANSCRIPTION_PROVIDER.GLADIA
    ) {
      this.captureMode = AUDIO_CAPTURE_MODE.CONTINUOUS;
    } else if (effectiveMode === TRANSCRIPTION_MODE.PAUSE_BATCH) {
      this.captureMode = AUDIO_CAPTURE_MODE.VAD_SEGMENTED;
    }

    this.startAcceptedResolve?.();
  };

  private readonly onRecovered = (payload: unknown) => {
    const sessionRunId = readString(payload, "sessionRunId");
    if (sessionRunId) {
      this.sessionRunId = sessionRunId;
    }

    const nextAudioSeq = readNonNegativeInteger(payload, "nextAudioSeq");
    if (nextAudioSeq !== null) {
      this.nextAudioSeq = nextAudioSeq;
      this.replayUnacknowledgedChunks();
    }

    this.reconnectAttempt = 0;
    this.emitReadyChunks();
  };

  private readonly onReconnectError = (payload: unknown) => {
    const code = readString(payload, "code");
    if (
      code === AUDIO_SESSION_ERROR_CODE.RUN_REPLACED ||
      code === AUDIO_SESSION_ERROR_CODE.CLOSED
    ) {
      this.isSessionActive = false;
    }
  };

  private readonly onChunkAccepted = (payload: unknown) => {
    const nextAudioSeq = readNonNegativeInteger(payload, "nextAudioSeq");
    if (nextAudioSeq === null) {
      return;
    }

    this.nextAudioSeq = Math.max(this.nextAudioSeq, nextAudioSeq);
    for (const seq of this.sentChunks.keys()) {
      if (seq < nextAudioSeq) {
        this.sentChunks.delete(seq);
      }
    }
  };

  private readonly onChunkError = (payload: unknown) => {
    const nextAudioSeq = readNonNegativeInteger(payload, "nextAudioSeq");
    if (nextAudioSeq !== null) {
      this.nextAudioSeq = nextAudioSeq;
      this.replayUnacknowledgedChunks();
      return;
    }

    if (readString(payload, "code") === AUDIO_SESSION_ERROR_CODE.CHUNK_SEQUENCE_GAP) {
      this.requestRecovery();
    }
  };

  private requestRecovery() {
    if (!this.socket?.connected || !this.sessionRunId || !this.protocol.buildReconnectEmit) {
      return;
    }

    this.reconnectAttempt = Math.min(this.reconnectAttempt + 1, MAX_AUDIO_RECONNECT_ATTEMPTS);
    const reconnectEmit = this.protocol.buildReconnectEmit({
      sessionRunId: this.sessionRunId,
      lastSentAudioSeq: this.lastSentAudioSeq,
      attempt: this.reconnectAttempt,
    });
    this.socket.emit(reconnectEmit.event, ...reconnectEmit.args);
  }

  private replayUnacknowledgedChunks() {
    if (!this.socket?.connected) {
      return;
    }

    for (const [seq, chunkBuffer] of this.sentChunks) {
      if (seq < this.nextAudioSeq) {
        continue;
      }

      const meta: PcmChunkMeta = {
        seq,
        sr: this.targetSr,
        samples: this.chunkSamples,
        ts_ms: performance.now(),
      };
      const chunkEmit = this.protocol.buildChunkEmit({ chunkMeta: meta, chunkBuffer });
      this.socket.emit(chunkEmit.event, ...chunkEmit.args);
    }
  }

  private trimSentChunks() {
    const maxBufferedChunks = 256;
    while (this.sentChunks.size > maxBufferedChunks) {
      const oldestSeq = this.sentChunks.keys().next().value;
      if (typeof oldestSeq !== "number") {
        return;
      }
      this.sentChunks.delete(oldestSeq);
    }
  }
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

function readNonNegativeInteger(payload: unknown, ...path: string[]): number | null {
  let current: unknown = payload;
  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }
  return typeof current === "number" && Number.isInteger(current) && current >= 0 ? current : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resampleAudio(audio: Float32Array, sourceSampleRate: number, targetSampleRate: number) {
  if (sourceSampleRate === targetSampleRate) {
    return audio;
  }

  const targetLength = Math.max(
    1,
    Math.round((audio.length * targetSampleRate) / sourceSampleRate),
  );
  const result = new Float32Array(targetLength);
  const ratio = sourceSampleRate / targetSampleRate;

  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, audio.length - 1);
    const weight = sourceIndex - lowerIndex;
    result[index] = audio[lowerIndex] * (1 - weight) + audio[upperIndex] * weight;
  }

  return result;
}

function calculateAudioLevel(audio: Float32Array) {
  if (audio.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const sample of audio) {
    sum += sample * sample;
  }

  return Math.min(1, Math.sqrt(sum / audio.length) * 4);
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
