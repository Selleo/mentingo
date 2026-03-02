/// <reference lib="webworker" />

class PcmVadProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const processorOptions = options?.processorOptions ?? {};

    this.targetSr = processorOptions.targetSr ?? 16000;
    this.chunkMs = processorOptions.chunkMs ?? 20;
    this.chunkSamples = Math.round(this.targetSr * (this.chunkMs / 1000));

    this.startFrames = processorOptions.vad?.startFrames ?? 3;
    this.stopFrames = processorOptions.vad?.stopFrames ?? 15;
    this.minRms = processorOptions.vad?.minRms ?? 0.008;
    this.thresholdMultiplier = processorOptions.vad?.thresholdMultiplier ?? 3;
    this.minZcr = processorOptions.vad?.minZcr ?? 0.02;
    this.maxZcr = processorOptions.vad?.maxZcr ?? 0.3;
    this.preRollFrames = processorOptions.vad?.preRollFrames ?? 10;

    this.resampleCarry = null;
    this.int16Queue = [];

    this.noiseFloor = this.minRms;
    this.speechRun = 0;
    this.silenceRun = 0;
    this.isSpeechActive = false;
    this.preRollQueue = [];
  }

  downsampleLinear(input) {
    let x = input;

    if (this.resampleCarry && this.resampleCarry.length > 0) {
      const merged = new Float32Array(this.resampleCarry.length + input.length);
      merged.set(this.resampleCarry, 0);
      merged.set(input, this.resampleCarry.length);
      x = merged;
    }

    // sampleRate is runtime global
    // eslint-disable-next-line no-undef
    if (this.targetSr === sampleRate) {
      this.resampleCarry = null;
      return x;
    }
    // eslint-disable-next-line no-undef
    const ratio = sampleRate / this.targetSr;
    const outLen = Math.floor(x.length / ratio);
    const out = new Float32Array(outLen);

    let t = 0;
    for (let i = 0; i < outLen; i++) {
      const i0 = Math.floor(t);
      const i1 = Math.min(i0 + 1, x.length - 1);
      const frac = t - i0;

      out[i] = x[i0] * (1 - frac) + x[i1] * frac;
      t += ratio;
    }

    const consumed = Math.floor(t);
    const leftover = x.length - consumed;
    this.resampleCarry = leftover > 0 ? x.slice(consumed) : null;

    return out;
  }

  detectSpeech(chunk) {
    let energy = 0;
    let zc = 0;
    let prevSign = 0;

    for (let i = 0; i < chunk.length; i++) {
      const s = chunk[i] / 32768;
      energy += s * s;

      const sign = s >= 0 ? 1 : -1;
      if (i > 0 && sign !== prevSign) zc += 1;
      prevSign = sign;
    }

    const rms = Math.sqrt(energy / Math.max(1, chunk.length));
    const normalizedLevel = Math.min(1, rms * 6);
    this.port.postMessage({ type: "level", level: normalizedLevel });

    if (!this.isSpeechActive) {
      const clampedRms = Math.min(rms, this.noiseFloor * 3);
      this.noiseFloor = this.noiseFloor * 0.95 + clampedRms * 0.05;
    }

    const zcr = zc / Math.max(1, chunk.length - 1);
    const threshold = Math.max(this.minRms, this.noiseFloor * this.thresholdMultiplier);

    return rms > threshold && zcr >= this.minZcr && zcr <= this.maxZcr;
  }

  emitChunk(chunk) {
    const buf = new ArrayBuffer(chunk.length * 2);
    const view = new DataView(buf);

    for (let i = 0; i < chunk.length; i++) {
      view.setInt16(i * 2, chunk[i], true);
    }

    this.port.postMessage({ type: "chunk", data: buf }, [buf]);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const ch0 = input[0];
    if (!ch0) return true;

    const resampled = this.downsampleLinear(ch0);

    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      const v = (s < 0 ? s * 0x8000 : s * 0x7fff) | 0;
      this.int16Queue.push(v);
    }

    while (this.int16Queue.length >= this.chunkSamples) {
      const chunk = this.int16Queue.splice(0, this.chunkSamples);
      const looksLikeSpeech = this.detectSpeech(chunk);

      if (looksLikeSpeech) {
        this.speechRun += 1;
        this.silenceRun = 0;
      } else {
        this.speechRun = 0;
        this.silenceRun += 1;
      }

      if (!this.isSpeechActive && this.speechRun >= this.startFrames) {
        this.isSpeechActive = true;
        for (let i = 0; i < this.preRollQueue.length; i++) {
          this.emitChunk(this.preRollQueue[i]);
        }
        this.preRollQueue = [];
      }

      if (this.isSpeechActive) {
        this.emitChunk(chunk);

        if (this.silenceRun >= this.stopFrames) {
          this.isSpeechActive = false;
          this.speechRun = 0;
          this.silenceRun = 0;
        }
      } else {
        this.preRollQueue.push(chunk);
        if (this.preRollQueue.length > this.preRollFrames) {
          this.preRollQueue.shift();
        }
      }
    }

    return true;
  }
}

registerProcessor("pcm-vad-gate", PcmVadProcessor);
