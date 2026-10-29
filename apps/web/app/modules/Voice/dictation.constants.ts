export const DICTATION_PHASES = {
  IDLE: "idle",
  STARTING: "starting",
  RECORDING: "recording",
  TRANSCRIBING: "transcribing",
  CANCELLING: "cancelling",
} as const;

export const DICTATION_TIMEOUT_MS = 15_000;
