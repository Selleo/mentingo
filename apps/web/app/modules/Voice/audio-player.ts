export type StreamingAudioChunk = ArrayBuffer | Uint8Array;

type StreamingAudioChunkOptions = {
  sampleRate?: number | null;
};

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
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private onIdle: (() => void) | null = null;
  private isPlayerIdle = true;

  constructor({
    sampleRate = 44100,
    channels = 1,
    gain = 1,
    leadTimeSeconds = 0.15,
  }: StreamingAudioPlayerOptions = {}) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.gain = gain;
    this.leadTimeSeconds = leadTimeSeconds;
  }

  async start() {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext({ sampleRate: this.sampleRate });
      await this.audioCtx.audioWorklet.addModule("/pcm-worklet-processor.js");

      this.workletNode = new AudioWorkletNode(this.audioCtx, "pcm-stream-player", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [this.channels],
        processorOptions: {
          channels: this.channels,
          initialBufferSamples: Math.round(
            this.audioCtx.sampleRate * this.leadTimeSeconds * this.channels,
          ),
          capacitySamples: Math.round(this.audioCtx.sampleRate * 10 * this.channels),
        },
      });
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        if (event.data?.type !== "idle-state") {
          return;
        }

        this.isPlayerIdle = Boolean(event.data.isIdle);
        if (this.isPlayerIdle) {
          this.onIdle?.();
        }
      };

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.gain;
      this.workletNode.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  async enqueue(chunk: StreamingAudioChunk, options: StreamingAudioChunkOptions = {}) {
    if (!this.audioCtx || !this.workletNode) {
      await this.start();
    }

    if (!this.audioCtx || !this.workletNode) {
      return;
    }

    const inputSampleRate = options.sampleRate ?? this.sampleRate;
    const samples = this.resampleIfNeeded(
      this.pcm16leToFloat32(chunk),
      inputSampleRate,
      this.audioCtx.sampleRate,
    );
    if (samples.length === 0) {
      return;
    }

    this.isPlayerIdle = false;
    if (samples.buffer instanceof ArrayBuffer) {
      this.workletNode.port.postMessage({ type: "samples", samples }, [samples.buffer]);
      return;
    }

    this.workletNode.port.postMessage({ type: "samples", samples });
  }

  isIdle() {
    return this.isPlayerIdle;
  }

  setOnIdle(callback: (() => void) | null) {
    this.onIdle = callback;
  }

  reset() {
    this.workletNode?.port.postMessage({ type: "reset" });
    this.isPlayerIdle = true;
  }

  async destroy() {
    this.reset();

    this.workletNode?.disconnect();
    this.gainNode?.disconnect();

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      await this.audioCtx.close();
    }

    this.audioCtx = null;
    this.workletNode = null;
    this.gainNode = null;
    this.onIdle = null;
    this.isPlayerIdle = true;
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

  private resampleIfNeeded(
    samples: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number,
  ): Float32Array {
    if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
      return samples;
    }

    if (inputSampleRate === outputSampleRate) {
      return samples;
    }

    const inputFrameCount = Math.floor(samples.length / this.channels);
    const outputFrameCount = Math.floor((inputFrameCount * outputSampleRate) / inputSampleRate);
    const output = new Float32Array(outputFrameCount * this.channels);
    const ratio = inputSampleRate / outputSampleRate;

    for (let outputFrame = 0; outputFrame < outputFrameCount; outputFrame += 1) {
      const inputFramePosition = outputFrame * ratio;
      const inputFrame = Math.floor(inputFramePosition);
      const nextInputFrame = Math.min(inputFrame + 1, inputFrameCount - 1);
      const fraction = inputFramePosition - inputFrame;

      for (let channel = 0; channel < this.channels; channel += 1) {
        const currentSample = samples[inputFrame * this.channels + channel] ?? 0;
        const nextSample = samples[nextInputFrame * this.channels + channel] ?? currentSample;

        output[outputFrame * this.channels + channel] =
          currentSample * (1 - fraction) + nextSample * fraction;
      }
    }

    return output;
  }
}
