import type { DICTATION_PHASES } from "../dictation.constants";

export type TextDictationPhase = (typeof DICTATION_PHASES)[keyof typeof DICTATION_PHASES];

export type TextDictationOptions = {
  value: string;
  onChange: (value: string) => void;
  blocked?: boolean;
  timeoutMs?: number;
};

export type TextDictationResult = {
  phase: TextDictationPhase;
  voiceLevel: number;
  error: boolean;
  isBusy: boolean;
  isRecording: boolean;
  showVoicePanel: boolean;
  isIdle: () => boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
};
