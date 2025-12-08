import type { AnnouncementActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type CreateAnnouncementData = {
  announcementId: UUIDType;
  actor: CurrentUser;
  announcement: AnnouncementActivityLogSnapshot;
};

export class CreateAnnouncementEvent {
  constructor(public readonly announcementData: CreateAnnouncementData) {}
}
