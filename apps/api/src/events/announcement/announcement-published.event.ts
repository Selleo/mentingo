import type { UUIDType } from "src/common";

type AnnouncementPublishedData = {
  announcementId: UUIDType;
};

export class AnnouncementPublishedEvent {
  constructor(public readonly announcementPublishedData: AnnouncementPublishedData) {}
}
