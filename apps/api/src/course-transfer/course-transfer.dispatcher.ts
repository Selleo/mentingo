import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { QueueService } from "src/queue";

import { COURSE_TRANSFER_JOB_TARGETS } from "./course-transfer.constants";
import { CourseTransferCoordinator } from "./course-transfer.coordinator";
import { CourseTransferRequestedEvent } from "./events/course-transfer-requested.event";
import { CourseTransferStreamRepository } from "./repositories/course-transfer-stream.repository";
import {
  courseTransferRequestedEventSchema,
  courseTransferSourceSchema,
} from "./schemas/course-transfer.schema";

@Injectable()
export class CourseTransferDispatcher implements OnModuleInit {
  constructor(
    private readonly courseTransferStreamRepository: CourseTransferStreamRepository,
    private readonly courseTransferCoordinator: CourseTransferCoordinator,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit(): void {
    this.outboxDirectHandlerService.register(
      CourseTransferRequestedEvent.name,
      (payload, eventId) => this.enqueueRequestedTransfer(payload, eventId),
    );
  }

  /** Hands a committed transfer request to the worker queue of its transfer kind. */
  async enqueueRequestedTransfer(payload: Record<string, unknown>, eventId: string): Promise<void> {
    if (!Value.Check(courseTransferRequestedEventSchema, payload)) {
      throw new Error("Invalid transfer dispatch event");
    }
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
