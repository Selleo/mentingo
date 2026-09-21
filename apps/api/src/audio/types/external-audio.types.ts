import type { AiMentorTTSPreset, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

export type ExternalAudioStartResult = { ok: true } | { ok: false; translationKey: string };

export type VoiceMentorSessionContext = {
  threadId: UUIDType;
  language: SupportedLanguages;
  voiceConfig?: {
    voiceMode: string;
    ttsPreset: string;
    customTtsReference: string | null;
  };
};

export type VoiceMentorStartConfig = {
  preset?: AiMentorTTSPreset;
  customTtsReference?: string;
};
