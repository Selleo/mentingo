import type { StreamInitPayload, VoiceAction } from "@repo/shared";
import type { UUIDType } from "src/common";

export interface AudioProcessor<T = unknown, R = unknown> {
  readonly name: string;
  run: (data: T) => Promise<R>;
}

export type StopAudioMessage = {
  clientId: string;
};

export type StartAudioBody = {
  voiceAction: VoiceAction;
  lessonId?: UUIDType;
  meta: StreamInitPayload;
};

export type SendTTSTriggerBody = {
  content: string;
};
