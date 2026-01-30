import type { AnnouncementActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

type CreateAnnouncementData = {
  announcementId: UUIDType;
  actor: ActorUserType;
  announcement: AnnouncementActivityLogSnapshot;
};

export class CreateAnnouncementEvent {
  constructor(public readonly announcementData: CreateAnnouncementData) {}
}
