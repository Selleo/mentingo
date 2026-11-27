import { Inject, Injectable, Logger } from "@nestjs/common";
import { ASSISTANT_SOCKET_EVENTS, type AssistantTranscriptUpdate } from "@repo/shared";

import { REALTIME_PUBLISHER, RealtimePublisher } from "src/websocket/realtime.publisher";

import type { AssistantActorIdentity, AssistantMessage, AssistantRun } from "./assistant.types";

export const assistantThreadRoom = (actor: AssistantActorIdentity, threadId: string) =>
  `assistant:${actor.tenantId}:${actor.userId}:${threadId}`;

const toMessage = (message: AssistantMessage): AssistantTranscriptUpdate["assistantMessage"] => ({
  id: message.id,
  threadId: message.threadId,
  clientMessageId: message.clientMessageId,
  role: message.role,
  text: message.text,
  status: message.status,
  sources: message.sources,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

@Injectable()
export class AssistantRealtimeService {
  private readonly logger = new Logger(AssistantRealtimeService.name);

  constructor(@Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher) {}

  /** A broadcast failure leaves the durable conversation available for reconciliation. */
  publish(run: AssistantRun, assistantMessage: AssistantMessage, userMessage?: AssistantMessage) {
    const event: AssistantTranscriptUpdate = {
      threadId: run.threadId,
      run: {
        id: run.id,
        threadId: run.threadId,
        status: run.status,
        activity: run.activity,
        errorCode: run.errorCode,
        workflowRunId: run.workflowRunId,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
      assistantMessage: toMessage(assistantMessage),
      ...(userMessage && { userMessage: toMessage(userMessage) }),
    };
    try {
      this.realtimePublisher.emitToRoom(
        ASSISTANT_SOCKET_EVENTS.TRANSCRIPT_UPDATED,
        assistantThreadRoom(run, run.threadId),
        event,
      );
    } catch {
      this.logger.warn(`Assistant realtime delivery unavailable for run ${run.id}`);
    }
  }
}
