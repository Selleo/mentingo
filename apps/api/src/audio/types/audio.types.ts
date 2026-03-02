import type { StreamInitPayload, VoiceAction } from "@repo/shared";

export interface AudioProcessor<T = unknown, R = unknown> {
  readonly name: string;
  run: (data: T) => Promise<R>;
}

export type StopAudioMessage = {
  clientId: string;
};

export type StartAudioBody = {
  voiceAction: VoiceAction;
  meta: StreamInitPayload;
};
