import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ViewAnnouncementData = {
  announcementId: UUIDType;
  actor: CurrentUser;
  context?: Record<string, string>;
};

export class ViewAnnouncementEvent {
  constructor(public readonly announcementReadData: ViewAnnouncementData) {}
}
