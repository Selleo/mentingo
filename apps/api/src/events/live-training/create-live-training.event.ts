import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type LiveTrainingCreationData = {
  liveTrainingId: UUIDType;
  actor: ActorUserType;
  language: SupportedLanguages;
};

export class CreateLiveTrainingEvent {
  constructor(public readonly liveTrainingCreationData: LiveTrainingCreationData) {}
}
