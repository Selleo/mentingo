export type StreamingAudioChunk = ArrayBuffer | Uint8Array;

type StreamingAudioPlayerOptions = {
  sampleRate?: number;
  channels?: number;
  gain?: number;
  leadTimeSeconds?: number;
  onLevelChange?: (level: number) => void;
  onPlaybackProgress?: (progress: AudioPlaybackProgress | null) => void;
};

export type AudioPlaybackProgress = {
  turnId: string;
  elapsedMs: number;
};

export class RealtimePCMPlayer {
  private readonly sampleRate: number;
  private readonly channels: number;
  private readonly leadTimeSeconds: number;
  private readonly gain: number;
  private readonly onLevelChange?: (level: number) => void;
  private readonly onPlaybackProgress?: (progress: AudioPlaybackProgress | null) => void;

  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private levelMonitorFrame: number | null = null;
  private levelMonitorBuffer: Float32Array | null = null;
  private onIdle: (() => void) | null = null;
  private activeTurnId: string | null = null;
  private activeTurnStartTime: number | null = null;

  constructor({
    sampleRate = 44100,
    channels = 1,
    gain = 1,
    leadTimeSeconds = 0.02,
    onLevelChange,
    onPlaybackProgress,
  }: StreamingAudioPlayerOptions = {}) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.gain = gain;
    this.leadTimeSeconds = leadTimeSeconds;
    this.onLevelChange = onLevelChange;
    this.onPlaybackProgress = onPlaybackProgress;
  }

  async start() {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext({ sampleRate: this.sampleRate });
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.gain;
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.levelMonitorBuffer = new Float32Array(this.analyserNode.fftSize);
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    this.nextStartTime = Math.max(
      this.nextStartTime,
      this.audioCtx.currentTime + this.leadTimeSeconds,
    );
  }

  async enqueue(chunk: StreamingAudioChunk, turnId?: string) {
    if (!this.audioCtx || !this.gainNode) {
      await this.start();
    }

    if (!this.audioCtx || !this.gainNode) {
      return;
    }

    const samples = this.pcm16leToFloat32(chunk);
    if (samples.length === 0) {
      return;
    }

    const frameCount = Math.floor(samples.length / this.channels);
    if (frameCount <= 0) {
      return;
    }

    const audioBuffer = this.audioCtx.createBuffer(this.channels, frameCount, this.sampleRate);

    for (let channelIndex = 0; channelIndex < this.channels; channelIndex += 1) {
      const channelData = audioBuffer.getChannelData(channelIndex);
      for (let frame = 0; frame < frameCount; frame += 1) {
        channelData[frame] = samples[frame * this.channels + channelIndex] ?? 0;
      }
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const startAt = Math.max(this.nextStartTime, this.audioCtx.currentTime + 0.005);
    if (turnId && turnId !== this.activeTurnId) {
      this.activeTurnId = turnId;
      this.activeTurnStartTime = startAt;
    }
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.activeSources.add(source);
    this.startLevelMonitor();
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.stopLevelMonitor();
        this.onLevelChange?.(0);
        this.onPlaybackProgress?.(null);
        this.onIdle?.();
      }
    };
  }

  isIdle() {
    return this.activeSources.size === 0;
  }

  setOnIdle(callback: (() => void) | null) {
    this.onIdle = callback;
  }

  reset() {
    if (!this.audioCtx) return;

    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Source may already be stopped.
      }
    }

    this.activeSources.clear();
    this.nextStartTime = this.audioCtx.currentTime + this.leadTimeSeconds;
    this.stopLevelMonitor();
    this.activeTurnId = null;
    this.activeTurnStartTime = null;
    this.onLevelChange?.(0);
    this.onPlaybackProgress?.(null);
  }

  async destroy() {
    this.reset();

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      await this.audioCtx.close();
    }

    this.audioCtx = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.levelMonitorBuffer = null;
    this.nextStartTime = 0;
    this.onIdle = null;
    this.onLevelChange?.(0);
  }

  private pcm16leToFloat32(chunk: StreamingAudioChunk): Float32Array {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    const totalSamples = Math.floor(bytes.length / 2);
    const out = new Float32Array(totalSamples);

    let byteOffset = 0;
    for (let i = 0; i < totalSamples; i += 1) {
      const lo = bytes[byteOffset] ?? 0;
      const hi = bytes[byteOffset + 1] ?? 0;
      const value = (hi << 8) | lo;
      const signed = value >= 0x8000 ? value - 0x10000 : value;

      out[i] = Math.max(-1, Math.min(1, signed / 32768));
      byteOffset += 2;
    }

    return out;
  }

  private calculateRmsLevel(samples: Float32Array) {
    if (samples.length === 0) {
      return 0;
    }

    let sumSquares = 0;
    for (const sample of samples) {
      sumSquares += sample * sample;
    }

    return Math.max(0, Math.min(1, Math.sqrt(sumSquares / samples.length) * 4));
  }

  private startLevelMonitor() {
    if (this.levelMonitorFrame !== null) {
      return;
    }

    const updateLevel = () => {
      this.levelMonitorFrame = null;

      if (!this.analyserNode || !this.levelMonitorBuffer || this.activeSources.size === 0) {
        this.onLevelChange?.(0);
        return;
      }

      this.analyserNode.getFloatTimeDomainData(this.levelMonitorBuffer);
      this.onLevelChange?.(this.calculateRmsLevel(this.levelMonitorBuffer));
      if (this.audioCtx && this.activeTurnId && this.activeTurnStartTime !== null) {
        this.onPlaybackProgress?.({
          turnId: this.activeTurnId,
          elapsedMs: Math.max(0, (this.audioCtx.currentTime - this.activeTurnStartTime) * 1_000),
        });
      }
      this.levelMonitorFrame = requestAnimationFrame(updateLevel);
    };

    this.levelMonitorFrame = requestAnimationFrame(updateLevel);
  }

  private stopLevelMonitor() {
    if (this.levelMonitorFrame === null) {
      return;
    }

    cancelAnimationFrame(this.levelMonitorFrame);
    this.levelMonitorFrame = null;
  }
}
