export type StreamingAudioChunk = ArrayBuffer | Uint8Array;

type StreamingAudioPlayerOptions = {
  sampleRate?: number;
  channels?: number;
  gain?: number;
  leadTimeSeconds?: number;
};

export class RealtimePCMPlayer {
  private readonly sampleRate: number;
  private readonly channels: number;
  private readonly leadTimeSeconds: number;
  private readonly gain: number;

  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private onIdle: (() => void) | null = null;

  constructor({
    sampleRate = 44100,
    channels = 1,
    gain = 1,
    leadTimeSeconds = 0.02,
  }: StreamingAudioPlayerOptions = {}) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.gain = gain;
    this.leadTimeSeconds = leadTimeSeconds;
  }

  async start() {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext({ sampleRate: this.sampleRate });
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.gain;
      this.gainNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    this.nextStartTime = Math.max(
      this.nextStartTime,
      this.audioCtx.currentTime + this.leadTimeSeconds,
    );
  }

  async enqueue(chunk: StreamingAudioChunk) {
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
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
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
  }

  async destroy() {
    this.reset();

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      await this.audioCtx.close();
    }

    this.audioCtx = null;
    this.gainNode = null;
    this.nextStartTime = 0;
    this.onIdle = null;
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
}
