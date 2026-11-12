import { Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { QueueService } from "src/queue";

import { COURSE_TRANSFER_JOB_TARGETS } from "./course-transfer.constants";
import { CourseTransferCoordinator } from "./course-transfer.coordinator";
import { CourseTransferRequestedEvent } from "./events/course-transfer-requested.event";
import { CourseTransferStreamRepository } from "./repositories/course-transfer-stream.repository";
import { courseTransferSourceSchema } from "./schemas/course-transfer.schema";

import type { CourseTransferRequestedData } from "./events/course-transfer-requested.event";
import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(CourseTransferRequestedEvent)
export class CourseTransferDispatcher
  implements OutboxEventsHandlerOf<CourseTransferRequestedEvent>
{
  constructor(
    private readonly courseTransferStreamRepository: CourseTransferStreamRepository,
    private readonly courseTransferCoordinator: CourseTransferCoordinator,
    private readonly queueService: QueueService,
  ) {}

  async handleOutboxEvent(event: CourseTransferRequestedEvent, { eventId }: OutboxDeliveryContext) {
    await this.enqueueRequestedTransfer(event.transferRequestData, eventId);
  }

  /** Hands a committed transfer request to the worker queue of its transfer kind. */
  async enqueueRequestedTransfer(
    payload: CourseTransferRequestedData,
    eventId: string,
  ): Promise<void> {
    const { operationId, sourceTenantId } = payload;

    const record = await this.courseTransferStreamRepository.findOperationWithStream(operationId);
    if (!record) return;

    const { stream, operation } = record;
    if (stream.sourceTenantId !== sourceTenantId) {
      throw new Error("Transfer dispatch tenant does not match");
    }
    if (stream.appliedRevision === stream.requestedRevision) return;
    if (!(await this.courseTransferCoordinator.isOperationDispatchable(operationId))) return;

    const jobTarget = COURSE_TRANSFER_JOB_TARGETS[stream.kind];
    const source = { sourceId: operation.payload[jobTarget.sourceIdKey] };
    if (!Value.Check(courseTransferSourceSchema, source)) {
      throw new Error(`Invalid ${stream.kind} transfer source`);
    }

    await this.queueService.enqueue(
      jobTarget.queueName,
      jobTarget.jobName,
      {
        operationId,
        exportId: stream.exportId,
        sourceTenantId: stream.sourceTenantId,
        targetTenantId: stream.targetTenantId,
        triggerEventType: CourseTransferRequestedEvent.name,
        [jobTarget.sourceIdKey]: source.sourceId,
      },
      {
        jobId: eventId,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }
}
