export type StreamInitPayload = {
  sr: number;
  channels: number;
  format: "pcm_s16le";
};

export type VoiceMentorTarget =
  | { lessonId: string; preview?: boolean; practiceSessionId?: never; threadId?: never }
  | { lessonId?: never; preview?: never; practiceSessionId: string; threadId: string };

export type PcmChunkMeta = {
  seq: number;
  sr: number;
  samples: number;
  ts_ms: number;
};
