import type { ActorUserType } from "src/common/types/actor-user.type";

type UpdateEnvData = {
  actor: ActorUserType;
  updatedEnvKeys: string[];
};

export class UpdateEnvEvent {
  constructor(public readonly updateEnvData: UpdateEnvData) {}
}
