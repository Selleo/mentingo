import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { AiPracticeQueueService } from "src/ai/ai-practice.queue.service";
import { AiMentorPracticeRequestedEvent } from "src/events";

@EventsHandler(AiMentorPracticeRequestedEvent)
export class AiPracticeRequestedHandler implements IEventHandler<AiMentorPracticeRequestedEvent> {
  constructor(private readonly queueService: AiPracticeQueueService) {}

  async handle(event: AiMentorPracticeRequestedEvent) {
    await this.queueService.enqueue(event.data);
  }
}
