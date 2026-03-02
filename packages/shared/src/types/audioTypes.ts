export type StreamInitPayload = {
  sr: number;
  channels: number;
  format: "pcm_s16le";
};

export type PcmChunkMeta = {
  seq: number;
  sr: number;
  samples: number;
  ts_ms: number;
};
