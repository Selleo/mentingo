import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type DeleteQAData = {
  qaId: UUIDType;
  qaName: string;
  actor: CurrentUser;
};

export class DeleteQAEvent {
  constructor(public readonly deleteQAData: DeleteQAData) {}
}
