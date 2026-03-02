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

export class RealtimePCMStreamerWorklet {
  private readonly protocol: StreamProtocol<unknown, unknown>;
  private socket: Socket | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private readonly onLevelChange?: (level: number) => void;

  private readonly targetSr = 16000;
  private readonly chunkMs = 20;
  private readonly channels = 1;

  private seq = 0;
  private readonly onSessionMetadataCleared = () => {
    this.seq = 0;
  };

  constructor(protocol: StreamProtocol<unknown, unknown>, onLevelChange?: (level: number) => void) {
    this.protocol = protocol;
    this.onLevelChange = onLevelChange;
  }

  async start<TStartContext>(context: TStartContext) {
    this.socket = acquireSocket();

    this.socket.on("voice:sessionMetadataCleared", this.onSessionMetadataCleared);

    this.socket.connect();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
      video: false,
    });

    this.audioCtx = new AudioContext();

    await this.audioCtx.audioWorklet.addModule("/pcm-worklet-processor.js");

    this.source = this.audioCtx.createMediaStreamSource(this.mediaStream);

    this.workletNode = new AudioWorkletNode(this.audioCtx, "pcm-vad-gate", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      processorOptions: {
        targetSr: this.targetSr,
        chunkMs: this.chunkMs,
        vad: {
          startFrames: 3,
          stopFrames: 28,
          preRollFrames: 24,
          minRms: 0.008,
          thresholdMultiplier: 3,
          minZcr: 0.02,
          maxZcr: 0.3,
        },
      },
    });

    this.workletNode.port.onmessage = (event) => {
      const message = event.data;
      if (!message) return;

      if (message.type === "level") {
        if (this.onLevelChange) {
          const level = Number(message.level) || 0;
          this.onLevelChange(Math.max(0, Math.min(1, level)));
        }

        return;
      }

      if (message.type !== "chunk") return;

      const chunkBuffer = message.data;

      if (!(chunkBuffer instanceof ArrayBuffer)) return;

      const meta: PcmChunkMeta = {
        seq: this.seq++,
        sr: this.targetSr,
        samples: chunkBuffer.byteLength / 2,
        ts_ms: performance.now(),
      };

      const chunkEmit = this.protocol.buildChunkEmit({
        chunkMeta: meta,
        chunkBuffer,
      });

      this.socket?.emit(chunkEmit.event, ...chunkEmit.args);
    };

    this.source.connect(this.workletNode);

    const startPayload: StreamInitPayload = {
      sr: this.targetSr,
      channels: this.channels,
      format: "pcm_s16le",
    };

    const startEmit = this.protocol.buildStartEmit({
      init: startPayload,
      context,
    });
    this.socket?.emit(startEmit.event, ...startEmit.args);
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

    this.cleanup();

    return ackPayload;
  }

  async cancel(): Promise<void> {
    const cancelEmit = this.protocol.buildCancelEmit();

    if (this.socket?.connected) {
      this.socket.emit(cancelEmit.event, ...cancelEmit.args);
    }

    this.cleanup();
  }

  private cleanup() {
    releaseSocket();

    this.socket?.off("voice:sessionMetadataCleared", this.onSessionMetadataCleared);
    this.workletNode?.disconnect();
    this.source?.disconnect();

    this.mediaStream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.mediaStream = null;

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      void this.audioCtx.close();
    }

    this.workletNode = null;
    this.source = null;
    this.audioCtx = null;
    this.socket = null;
    this.seq = 0;
  }
}
