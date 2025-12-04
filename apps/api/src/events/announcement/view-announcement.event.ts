import type { UUIDType } from "src/common";

type ViewAnnouncementData = {
  announcementId: UUIDType;
  readById: UUIDType;
  context?: Record<string, string>;
};

export class ViewAnnouncementEvent {
  constructor(public readonly announcementReadData: ViewAnnouncementData) {}
}
