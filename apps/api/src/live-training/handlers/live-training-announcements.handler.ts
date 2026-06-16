import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  CreateLiveTrainingEvent,
  DeleteLiveTrainingEvent,
  UpdateLiveTrainingEvent,
} from "src/events";

import { LiveTrainingAnnouncementsService } from "../live-training-announcements.service";

type LiveTrainingAnnouncementEvent =
  | CreateLiveTrainingEvent
  | UpdateLiveTrainingEvent
  | DeleteLiveTrainingEvent;

@Injectable()
@EventsHandler(CreateLiveTrainingEvent, UpdateLiveTrainingEvent, DeleteLiveTrainingEvent)
export class LiveTrainingAnnouncementsHandler
  implements IEventHandler<LiveTrainingAnnouncementEvent>
{
  constructor(
    private readonly liveTrainingAnnouncementsService: LiveTrainingAnnouncementsService,
  ) {}

  async handle(event: LiveTrainingAnnouncementEvent) {
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
