import type { UUIDType } from "src/common";

type UpdateEnvData = {
  actorId: UUIDType;
  updatedEnvKeys: string[];
};

export class UpdateEnvEvent {
  constructor(public readonly updateEnvData: UpdateEnvData) {}
}
