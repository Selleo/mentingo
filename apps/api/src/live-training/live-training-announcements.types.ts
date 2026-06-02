import type { LiveTrainingRepository } from "./live-training.repository";
import type { AnnouncementEmailTemplate } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type LiveTrainingNotificationRow = NonNullable<
  Awaited<ReturnType<LiveTrainingRepository["getLiveTrainingNotificationRow"]>>
>;

export type BuildLiveTrainingAnnouncementInput = {
  liveTraining: LiveTrainingNotificationRow;
  actor: CurrentUserType;
  emailTemplate: AnnouncementEmailTemplate;
};
