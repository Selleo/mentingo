import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type ViewAnnouncementData = {
  announcementId: UUIDType;
  actor: ActorUserType;
  context?: Record<string, string>;
};

export class ViewAnnouncementEvent {
  constructor(public readonly announcementReadData: ViewAnnouncementData) {}
}
