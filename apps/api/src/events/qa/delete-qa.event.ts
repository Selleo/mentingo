import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type DeleteQAData = {
  qaId: UUIDType;
  qaName: string;
  actor: ActorUserType;
};

export class DeleteQAEvent {
  constructor(public readonly deleteQAData: DeleteQAData) {}
}
