import { VOICE_ENDPOINTING_MODE, VOICE_SOCKET_EVENT } from "@repo/shared";
import { MicVAD } from "@ricky0123/vad-web";

import { acquireSocket, releaseSocket } from "~/api/socket";

import { resolveVoiceEndpointingMode } from "./audio-capture-mode";
import {
  AUDIO_SESSION_ERROR_CODE,
  VOICE_CONNECTION_STATE,
  type AudioReconnectContext,
  type AudioStreamLifecycleEvents,
  type VoiceConnectionState,
} from "./audio-stream.types";
import {
  advanceVadEndDeferral,
  beginVadEndDeferral,
  createVadEndDeferralState,
  shouldForwardVadEndFrame,
  VAD_END_DEFERRAL_PHASE,
  type VadEndDeferralState,
} from "./vad-end-deferral";

import type {
  ClientSpeechBoundaryPayload,
  PcmChunkMeta,
  StreamInitPayload,
  VoiceEndpointingMode,
} from "@repo/shared";
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
  buildSpeechStartEmit?: (params: { boundary: ClientSpeechBoundaryPayload }) => SocketEmitSpec;
  buildSpeechEndEmit?: (params: { boundary: ClientSpeechBoundaryPayload }) => SocketEmitSpec;
  resolveEndpointingMode?: (context: TStartContext) => VoiceEndpointingMode;
  keepsClientVadTurnOpen?: (context: TStartContext) => boolean;
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
  voiceMentorRedemptionMs: 300,
  redemptionMs: 700,
  preSpeechPadMs: 500,
} as const;
const MAX_AUDIO_RECONNECT_ATTEMPTS = 8;
const START_ACCEPT_TIMEOUT_MS = 10000;
const AUDIO_LEVEL_NOISE_FLOOR = 0.008;
const AUDIO_LEVEL_SCALE = 4;

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
  private readonly onRecoveryError?: (code: string) => void;
  private readonly onRecoveryStateChange?: (state: VoiceConnectionState) => void;

  private readonly targetSr = 16000;
  private readonly chunkMs = 32;
  private readonly channels = 1;
  private readonly chunkSamples = (this.targetSr * this.chunkMs) / 1000;
  private readonly preSpeechMaxSamples = (this.targetSr * (VAD_CONFIG.preSpeechPadMs + 120)) / 1000;

  private nextAudioSeq = 1;
  private serverNextAudioSeq: number | null = null;
  private lastSentAudioSeq = -1;
  private sessionRunId: string | null = null;
  private reconnectAttempt = 0;
  private isRecovering = false;
  private readonly outboundOperations: Array<{ operation: () => void; seq?: number }> = [];
  private isPumpingOutbound = false;
  private speechBoundarySeq = 0;
  private isSessionActive = false;
  private endpointingMode: VoiceEndpointingMode = VOICE_ENDPOINTING_MODE.CLIENT_VAD;
  private keepClientVadTurnOpen = false;
  private readonly sentChunks = new Map<number, ArrayBuffer>();
  private pendingSamples: number[] = [];
  private preSpeechSamples: number[] = [];
  private isSpeaking = false;
  private hasActiveSpeechSegment = false;
  private vadEndDeferral: VadEndDeferralState = createVadEndDeferralState();
  private isMuted = false;
  private captureGeneration = 0;
  private startAcceptedResolve: (() => void) | null = null;
  private startAcceptedReject: ((reason: unknown) => void) | null = null;
  private readonly onSocketConnect = () => {
    if (!this.isSessionActive) {
      return;
    }

    if (this.sessionRunId && this.protocol.buildReconnectEmit) {
      this.pauseOutboundAndRequestRecovery();
      return;
    }

    void this.pumpOutbound();
  };
  private readonly onSessionMetadataCleared = () => {
    this.captureGeneration += 1;
    void this.destroyMicVad();
    void this.stopContinuousCapture();
    this.startAcceptedReject?.(new Error("AUDIO_START_CANCELLED"));
    this.startAcceptedResolve = null;
    this.startAcceptedReject = null;
    this.nextAudioSeq = 1;
    this.serverNextAudioSeq = null;
    this.lastSentAudioSeq = -1;
    this.sessionRunId = null;
    this.reconnectAttempt = 0;
    this.isRecovering = false;
    this.outboundOperations.length = 0;
    this.isPumpingOutbound = false;
    this.speechBoundarySeq = 0;
    this.isSessionActive = false;
    this.endpointingMode = VOICE_ENDPOINTING_MODE.CLIENT_VAD;
    this.keepClientVadTurnOpen = false;
    this.sentChunks.clear();
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
    this.isMuted = false;
  };

  constructor(
    protocol: StreamProtocol<unknown, unknown>,
    onLevelChange?: (level: number) => void,
    onChunkSent?: (meta: PcmChunkMeta) => void,
    onRecoveryError?: (code: string) => void,
    onRecoveryStateChange?: (state: VoiceConnectionState) => void,
  ) {
    this.protocol = protocol;
    this.onLevelChange = onLevelChange;
    this.onChunkSent = onChunkSent;
    this.onRecoveryError = onRecoveryError;
    this.onRecoveryStateChange = onRecoveryStateChange;
  }

  async start<TStartContext>(context: TStartContext) {
    if (this.isSessionActive) {
      throw new Error("AUDIO_SESSION_ALREADY_ACTIVE");
    }

    this.captureGeneration += 1;
    if (!this.socket) {
      this.socket = acquireSocket();
      this.socket.on("connect", this.onSocketConnect);
      this.socket.on(VOICE_SOCKET_EVENT.SESSION_METADATA_CLEARED, this.onSessionMetadataCleared);
      this.registerLifecycleHandlers();
    }

    this.nextAudioSeq = 1;
    this.serverNextAudioSeq = null;
    this.lastSentAudioSeq = -1;
    this.sessionRunId = null;
    this.reconnectAttempt = 0;
    this.isRecovering = false;
    this.outboundOperations.length = 0;
    this.isPumpingOutbound = false;
    this.speechBoundarySeq = 0;
    this.isSessionActive = false;
    this.endpointingMode =
      this.protocol.resolveEndpointingMode?.(context) ?? VOICE_ENDPOINTING_MODE.CLIENT_VAD;
    this.keepClientVadTurnOpen = this.protocol.keepsClientVadTurnOpen?.(context) ?? false;
    this.sentChunks.clear();
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();

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

      if (this.endpointingMode === VOICE_ENDPOINTING_MODE.PROVIDER) {
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

    const captureGeneration = this.captureGeneration;
    this.micVad = await MicVAD.new({
      model: "v5",
      startOnLoad: false,
      submitUserSpeechOnPause: true,
      positiveSpeechThreshold: VAD_CONFIG.positiveSpeechThreshold,
      negativeSpeechThreshold: VAD_CONFIG.negativeSpeechThreshold,
      minSpeechMs: VAD_CONFIG.minSpeechMs,
      redemptionMs: this.keepClientVadTurnOpen
        ? VAD_CONFIG.voiceMentorRedemptionMs
        : VAD_CONFIG.redemptionMs,
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
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        const level = Number(probabilities.isSpeech) || 0;
        this.onLevelChange?.(this.isMuted ? 0 : Math.max(0, Math.min(1, level)));

        if (this.isMuted) {
          this.pendingSamples = [];
          this.preSpeechSamples = [];
          this.vadEndDeferral = createVadEndDeferralState();
          return;
        }

        const pcm16Frame = float32ToPcm16(frame);

        if (this.keepClientVadTurnOpen) {
          if (!this.hasActiveSpeechSegment) {
            this.appendPreSpeechSamples(pcm16Frame);
            return;
          }

          if (pcm16Frame.length > 0) {
            this.pendingSamples.push(...pcm16Frame);
            this.emitReadyChunks();
          }
          return;
        }

        if (!this.isSpeaking && pcm16Frame.length > 0) {
          this.appendPreSpeechSamples(pcm16Frame);
        }

        if (!this.isSpeaking) {
          return;
        }

        const frameRms = calculateRms(frame);
        const isDeferringEnd = this.vadEndDeferral.phase === VAD_END_DEFERRAL_PHASE.PENDING;
        if (pcm16Frame.length > 0 && (!isDeferringEnd || shouldForwardVadEndFrame(frameRms))) {
          this.pendingSamples.push(...pcm16Frame);
          this.emitReadyChunks();
        }

        this.advanceDeferredSpeechEnd(frameRms, frame.length);
      },
      onSpeechStart: () => undefined,
      onSpeechRealStart: () => {
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        if (this.endpointingMode === VOICE_ENDPOINTING_MODE.PROVIDER || this.isMuted) {
          return;
        }

        if (this.keepClientVadTurnOpen) {
          if (this.isSpeaking) {
            return;
          }

          this.isSpeaking = true;
          this.emitSpeechStartBoundary();

          if (!this.hasActiveSpeechSegment) {
            this.hasActiveSpeechSegment = true;
            if (this.preSpeechSamples.length > 0) {
              this.pendingSamples.push(...this.preSpeechSamples);
              this.preSpeechSamples = [];
              this.emitReadyChunks();
            }
          }
          return;
        }

        if (this.hasActiveSpeechSegment) {
          this.vadEndDeferral = createVadEndDeferralState();
          this.isSpeaking = true;
          return;
        }

        this.vadEndDeferral = createVadEndDeferralState();
        this.isSpeaking = true;
        this.hasActiveSpeechSegment = true;
        this.emitSpeechStartBoundary();
        if (this.preSpeechSamples.length > 0) {
          this.pendingSamples.push(...this.preSpeechSamples);
          this.preSpeechSamples = [];
          this.emitReadyChunks();
        }
      },
      onSpeechEnd: () => {
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        if (this.endpointingMode === VOICE_ENDPOINTING_MODE.PROVIDER) {
          return;
        }

        if (this.isMuted || !this.hasActiveSpeechSegment) {
          return;
        }

        if (this.keepClientVadTurnOpen) {
          if (!this.isSpeaking) {
            return;
          }

          this.isSpeaking = false;
          this.emitSpeechEndBoundary();
          return;
        }

        this.preSpeechSamples = [];
        this.vadEndDeferral = beginVadEndDeferral(this.vadEndDeferral);
      },
      onVADMisfire: () => {
        if (!this.isCaptureGenerationActive(captureGeneration)) {
          return;
        }

        if (this.endpointingMode === VOICE_ENDPOINTING_MODE.PROVIDER) {
          return;
        }

        if (this.keepClientVadTurnOpen) {
          return;
        }

        if (this.hasActiveSpeechSegment) {
          this.vadEndDeferral = beginVadEndDeferral(this.vadEndDeferral);
          return;
        }

        this.isSpeaking = false;
        this.pendingSamples = [];
        this.preSpeechSamples = [];
        this.hasActiveSpeechSegment = false;
        this.vadEndDeferral = createVadEndDeferralState();
      },
    });
  }

  async stop<TStopContext>(context?: TStopContext): Promise<unknown | null> {
    this.captureGeneration += 1;
    this.vadEndDeferral = createVadEndDeferralState();
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

  closeLearnerTurn() {
    if (!this.keepClientVadTurnOpen) {
      return;
    }

    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
  }

  async setMuted(isMuted: boolean) {
    this.isMuted = isMuted;
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
    this.onLevelChange?.(0);

    if (this.endpointingMode === VOICE_ENDPOINTING_MODE.PROVIDER) {
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
    this.captureGeneration += 1;
    this.vadEndDeferral = createVadEndDeferralState();
    const cancelEmit = this.protocol.buildCancelEmit();

    if (this.socket?.connected) {
      this.socket.emit(cancelEmit.event, ...cancelEmit.args);
    }

    await this.cleanup();
  }

  private async cleanup() {
    this.captureGeneration += 1;
    this.startAcceptedReject?.(new Error("AUDIO_START_CANCELLED"));
    this.startAcceptedResolve = null;
    this.startAcceptedReject = null;
    releaseSocket();

    this.socket?.off("connect", this.onSocketConnect);
    this.socket?.off(VOICE_SOCKET_EVENT.SESSION_METADATA_CLEARED, this.onSessionMetadataCleared);
    this.unregisterLifecycleHandlers();
    this.socket = null;
    this.nextAudioSeq = 1;
    this.serverNextAudioSeq = null;
    this.lastSentAudioSeq = -1;
    this.sessionRunId = null;
    this.reconnectAttempt = 0;
    this.isRecovering = false;
    this.outboundOperations.length = 0;
    this.isPumpingOutbound = false;
    this.speechBoundarySeq = 0;
    this.isSessionActive = false;
    this.endpointingMode = VOICE_ENDPOINTING_MODE.CLIENT_VAD;
    this.keepClientVadTurnOpen = false;
    this.sentChunks.clear();
    this.pendingSamples = [];
    this.preSpeechSamples = [];
    this.isSpeaking = false;
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
    this.isMuted = false;

    await this.destroyMicVad();

    await this.stopContinuousCapture();
  }

  private async destroyMicVad() {
    const micVad = this.micVad;
    this.micVad = null;
    await micVad?.destroy().catch(() => undefined);
  }

  private emitReadyChunks() {
    if (!this.socket) {
      return;
    }

    while (this.pendingSamples.length >= this.chunkSamples) {
      this.emitChunk(this.pendingSamples.splice(0, this.chunkSamples));
    }
  }

  private emitChunk(samples: number[]) {
    if (!this.socket || samples.length === 0) {
      return;
    }

    const chunkBuffer = copyToArrayBuffer(Int16Array.from(samples));
    const meta: PcmChunkMeta = {
      seq: this.nextAudioSeq++,
      sr: this.targetSr,
      samples: samples.length,
      ts_ms: performance.now(),
    };
    const chunkEmit = this.protocol.buildChunkEmit({
      chunkMeta: meta,
      chunkBuffer,
    });

    this.sentChunks.set(meta.seq, chunkBuffer);
    this.trimSentChunks();
    this.enqueueOutbound(() => {
      this.socket?.emit(chunkEmit.event, ...chunkEmit.args);
      this.lastSentAudioSeq = Math.max(this.lastSentAudioSeq, meta.seq);
    }, meta.seq);

    if (this.endpointingMode === VOICE_ENDPOINTING_MODE.CLIENT_VAD) {
      this.onChunkSent?.(meta);
    }
  }

  private appendPreSpeechSamples(samples: Int16Array) {
    if (samples.length === 0) {
      return;
    }

    this.preSpeechSamples.push(...samples);
    if (this.preSpeechSamples.length > this.preSpeechMaxSamples) {
      this.preSpeechSamples.splice(0, this.preSpeechSamples.length - this.preSpeechMaxSamples);
    }
  }

  private emitSpeechEndBoundary() {
    if (!this.hasActiveSpeechSegment) {
      this.pendingSamples = [];
      return;
    }

    this.emitReadyChunks();
    this.emitChunk(this.pendingSamples.splice(0));

    const buildSpeechEndEmit = this.protocol.buildSpeechEndEmit;
    if (!this.sessionRunId || !buildSpeechEndEmit) {
      return;
    }

    const boundarySeq = ++this.speechBoundarySeq;
    const tsMs = performance.now();
    const lastAudioSeq = Math.max(this.lastSentAudioSeq, this.nextAudioSeq - 1);
    this.enqueueOutbound(() => {
      if (!this.sessionRunId) {
        return;
      }

      const boundaryEmit = buildSpeechEndEmit({
        boundary: {
          sessionRunId: this.sessionRunId,
          boundarySeq,
          tsMs,
          lastAudioSeq,
        },
      });
      this.socket?.emit(boundaryEmit.event, ...boundaryEmit.args);
    });
  }

  private advanceDeferredSpeechEnd(frameRms: number, frameSamples: number) {
    const result = advanceVadEndDeferral(
      this.vadEndDeferral,
      frameRms,
      (frameSamples / this.targetSr) * 1000,
    );
    this.vadEndDeferral = result.state;

    if (result.shouldFinalize) {
      this.completeActiveSpeechSegment();
    }
  }

  private completeActiveSpeechSegment() {
    if (!this.hasActiveSpeechSegment) {
      return;
    }

    this.isSpeaking = false;
    this.preSpeechSamples = [];
    this.emitSpeechEndBoundary();
    this.hasActiveSpeechSegment = false;
    this.vadEndDeferral = createVadEndDeferralState();
  }

  private enqueueOutbound(operation: () => void, seq?: number) {
    this.outboundOperations.push({ operation, seq });
    void this.pumpOutbound();
  }

  private async pumpOutbound() {
    if (this.isPumpingOutbound || this.isRecovering) {
      return;
    }

    this.isPumpingOutbound = true;
    try {
      while (!this.isRecovering && this.socket?.connected && this.outboundOperations.length > 0) {
        const operation = this.outboundOperations.shift();
        operation?.operation();
        await Promise.resolve();
      }
    } finally {
      this.isPumpingOutbound = false;
    }
  }

  private pauseOutboundAndRequestRecovery() {
    if (this.isRecovering) {
      return;
    }

    this.isRecovering = true;
    this.onRecoveryStateChange?.(VOICE_CONNECTION_STATE.RECOVERING);
    this.requestRecovery();
  }

  private emitSpeechStartBoundary() {
    const buildSpeechStartEmit = this.protocol.buildSpeechStartEmit;
    if (!this.sessionRunId || !buildSpeechStartEmit) {
      return;
    }

    const boundarySeq = ++this.speechBoundarySeq;
    const tsMs = performance.now();
    const lastAudioSeq = this.lastSentAudioSeq;
    this.enqueueOutbound(() => {
      if (!this.sessionRunId) {
        return;
      }

      const boundaryEmit = buildSpeechStartEmit({
        boundary: {
          sessionRunId: this.sessionRunId,
          boundarySeq,
          tsMs,
          lastAudioSeq,
        },
      });
      this.socket?.emit(boundaryEmit.event, ...boundaryEmit.args);
    });
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
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
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
    if (events.recoveryStarted) {
      this.socket.on(events.recoveryStarted, this.onRecoveryStarted);
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
    if (events.recoveryStarted) {
      this.socket.off(events.recoveryStarted, this.onRecoveryStarted);
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
    if (nextAudioSeq !== null) {
      this.serverNextAudioSeq = nextAudioSeq;
      if (this.lastSentAudioSeq < 0) {
        this.nextAudioSeq = Math.max(this.nextAudioSeq, nextAudioSeq);
      }
    }

    this.endpointingMode = resolveVoiceEndpointingMode(payload, this.endpointingMode);
    this.onRecoveryStateChange?.(VOICE_CONNECTION_STATE.CONNECTED);

    this.startAcceptedResolve?.();
  };

  private readonly onRecoveryStarted = () => {
    this.isRecovering = true;
    this.onRecoveryStateChange?.(VOICE_CONNECTION_STATE.RECOVERING);
  };

  private readonly onRecovered = (payload: unknown) => {
    const sessionRunId = readString(payload, "sessionRunId");
    if (sessionRunId) {
      this.sessionRunId = sessionRunId;
    }

    const nextAudioSeq = readNonNegativeInteger(payload, "nextAudioSeq");
    if (nextAudioSeq !== null) {
      this.serverNextAudioSeq = nextAudioSeq;
      const replayed = this.replayUnacknowledgedChunks(nextAudioSeq);
      if (!replayed) {
        return;
      }
    }

    this.isRecovering = false;
    this.reconnectAttempt = 0;
    this.onRecoveryStateChange?.(VOICE_CONNECTION_STATE.CONNECTED);
    void this.pumpOutbound();
  };

  private readonly onReconnectError = (payload: unknown) => {
    this.failRecovery(readString(payload, "code") ?? "AUDIO_RECOVERY_FAILED");
  };

  private readonly onChunkAccepted = (payload: unknown) => {
    const nextAudioSeq = readNonNegativeInteger(payload, "nextAudioSeq");
    if (nextAudioSeq === null) {
      return;
    }

    this.serverNextAudioSeq = Math.max(this.serverNextAudioSeq ?? 0, nextAudioSeq);
    this.removeAcknowledgedQueuedChunks(nextAudioSeq);
    for (const seq of this.sentChunks.keys()) {
      if (seq < nextAudioSeq) {
        this.sentChunks.delete(seq);
      }
    }
  };

  private readonly onChunkError = (payload: unknown) => {
    const nextAudioSeq = readNonNegativeInteger(payload, "nextAudioSeq");
    if (nextAudioSeq !== null) {
      this.serverNextAudioSeq = nextAudioSeq;
      this.pauseOutboundAndRequestRecovery();
      return;
    }

    if (readString(payload, "code") === AUDIO_SESSION_ERROR_CODE.CHUNK_SEQUENCE_GAP) {
      this.pauseOutboundAndRequestRecovery();
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

  private replayUnacknowledgedChunks(expectedNextAudioSeq: number): boolean {
    if (!this.socket?.connected) {
      return false;
    }

    const replayable = [...this.sentChunks.entries()].filter(
      ([seq]) => seq >= expectedNextAudioSeq && seq < this.nextAudioSeq,
    );
    const firstBufferedSeq = replayable[0]?.[0];
    if (
      expectedNextAudioSeq < this.nextAudioSeq &&
      (firstBufferedSeq === undefined || firstBufferedSeq > expectedNextAudioSeq)
    ) {
      this.failRecovery("AUDIO_SEQUENCE_RECOVERY_BUFFER_MISS");
      return false;
    }

    const queuedSequences = new Set(
      this.outboundOperations.flatMap(({ seq }) => (seq === undefined ? [] : [seq])),
    );
    this.removeAcknowledgedQueuedChunks(expectedNextAudioSeq);
    const replayOperations = replayable
      .filter(([seq]) => !queuedSequences.has(seq))
      .map(([seq, chunkBuffer]) => {
        const meta: PcmChunkMeta = {
          seq,
          sr: this.targetSr,
          samples: chunkBuffer.byteLength / Int16Array.BYTES_PER_ELEMENT / this.channels,
          ts_ms: performance.now(),
        };
        const chunkEmit = this.protocol.buildChunkEmit({ chunkMeta: meta, chunkBuffer });
        return {
          seq,
          operation: () => this.socket?.emit(chunkEmit.event, ...chunkEmit.args),
        };
      });
    this.outboundOperations.unshift(...replayOperations);

    return true;
  }

  private removeAcknowledgedQueuedChunks(nextAudioSeq: number) {
    const pendingOperations = this.outboundOperations.filter(
      ({ seq }) => seq === undefined || seq >= nextAudioSeq,
    );
    this.outboundOperations.splice(0, this.outboundOperations.length, ...pendingOperations);
  }

  private failRecovery(code: string) {
    this.isRecovering = true;
    this.isSessionActive = false;
    const cancelEmit = this.protocol.buildCancelEmit();
    this.socket?.emit(cancelEmit.event, ...cancelEmit.args);
    void this.cleanup().finally(() => {
      this.onRecoveryError?.(code);
      this.onRecoveryStateChange?.(VOICE_CONNECTION_STATE.FAILED);
    });
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

  private isCaptureGenerationActive(captureGeneration: number) {
    return this.isSessionActive && captureGeneration === this.captureGeneration;
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
  const rms = calculateRms(audio);
  const signal = Math.max(0, rms - AUDIO_LEVEL_NOISE_FLOOR);

  return Math.min(1, Math.sqrt(signal) * AUDIO_LEVEL_SCALE);
}

function calculateRms(audio: Float32Array) {
  if (audio.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const sample of audio) {
    sum += sample * sample;
  }

  return Math.sqrt(sum / audio.length);
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
