import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type SupportModeEnterData = {
  supportSessionId: UUIDType;
  sourceUserId: UUIDType;
  sourceTenantId: UUIDType;
  targetUserId: UUIDType;
  targetTenantId: UUIDType;
  actor: ActorUserType;
};

export class SupportModeEnterEvent {
  constructor(public readonly supportModeEnterData: SupportModeEnterData) {}
}
