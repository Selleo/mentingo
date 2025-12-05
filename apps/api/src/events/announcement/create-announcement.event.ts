import type { AnnouncementActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";

type CreateAnnouncementData = {
  announcementId: UUIDType;
  createdById: UUIDType;
  announcement: AnnouncementActivityLogSnapshot;
};

export class CreateAnnouncementEvent {
  constructor(public readonly announcementData: CreateAnnouncementData) {}
}
