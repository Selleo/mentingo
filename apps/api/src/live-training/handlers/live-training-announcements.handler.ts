import { Injectable } from "@nestjs/common";

import {
  CreateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  UpdateLiveTrainingEvent,
} from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { LiveTrainingAnnouncementsService } from "../live-training-announcements.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type LiveTrainingAnnouncementEvent =
  | CreateLiveTrainingEvent
  | UpdateLiveTrainingEvent
  | DeleteLiveTrainingEvent;

@Injectable()
@OutboxEventsHandler(CreateLiveTrainingEvent, UpdateLiveTrainingEvent, DeleteLiveTrainingEvent)
export class LiveTrainingAnnouncementsHandler
  implements OutboxEventsHandlerOf<LiveTrainingAnnouncementEvent>
{
  constructor(
    private readonly liveTrainingAnnouncementsService: LiveTrainingAnnouncementsService,
  ) {}

  async handleOutboxEvent(event: LiveTrainingAnnouncementEvent) {
    if (event instanceof CreateLiveTrainingEvent) {
      return this.liveTrainingAnnouncementsService.syncStartsSoonReminder(
        event.liveTrainingCreationData.liveTrainingId,
        event.liveTrainingCreationData.actor,
      );
    }

    if (event instanceof UpdateLiveTrainingEvent) {
      return this.liveTrainingAnnouncementsService.syncStartsSoonReminder(
        event.liveTrainingUpdateData.liveTrainingId,
        event.liveTrainingUpdateData.actor,
      );
    }

    return this.liveTrainingAnnouncementsService.cancelStartsSoonReminder(
      event.liveTrainingDeleteData.liveTrainingId,
    );
  }
}
