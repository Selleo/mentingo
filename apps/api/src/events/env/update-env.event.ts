import type { CurrentUser } from "src/common/types/current-user.type";

type UpdateEnvData = {
  actor: CurrentUser;
  updatedEnvKeys: string[];
};

export class UpdateEnvEvent {
  constructor(public readonly updateEnvData: UpdateEnvData) {}
}
