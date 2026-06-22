import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingDeleteData = {
  liveTrainingId: UUIDType;
  actor: ActorUserType;
  language: SupportedLanguages;
};

export class DeleteLiveTrainingEvent {
  constructor(public readonly liveTrainingDeleteData: LiveTrainingDeleteData) {}
}
