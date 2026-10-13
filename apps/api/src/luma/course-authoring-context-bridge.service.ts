/** Polls durable authoring events and queues selected-detail fulfillment independently of browser sockets. */
import { createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { QUEUE_NAMES, QueueService } from "src/queue";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CourseAuthoringContextBridgeRepository } from "./course-authoring-context-bridge.repository";
import { LumaService } from "./luma.service";
import { authoringEventsSchema } from "./schema/course-authoring-session.schema";

import type {
  CourseAuthoringContextBinding,
  CourseAuthoringContextRequest,
} from "./course-authoring-context-bridge.types";
import type { UUIDType } from "src/common";
import type { CourseAuthoringContextFulfillmentJob } from "src/queue/queue.types";

const contextRequestSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  contextRequestId: Type.String({ format: "uuid" }),
  sessionId: Type.String({ format: "uuid" }),
  requestId: Type.String({ format: "uuid" }),
  taskId: Type.String({ format: "uuid" }),
  taskFence: Type.Integer({ minimum: 1 }),
  courseId: Type.String({ format: "uuid" }),
  language: Type.Enum(SUPPORTED_LANGUAGES),
  lessonIds: Type.Array(Type.String({ format: "uuid" }), { maxItems: 100 }),
  targetKinds: Type.Array(Type.String()),
  requestHash: Type.String({ minLength: 1 }),
});

@Injectable()
export class CourseAuthoringContextBridgeService {
  private readonly logger = new Logger(CourseAuthoringContextBridgeService.name);
  private scanning = false;
  private static readonly POLL_BATCH_SIZE = 50;
  private static readonly ENQUEUE_BATCH_SIZE = 100;

  constructor(
    private readonly repository: CourseAuthoringContextBridgeRepository,
    private readonly luma: LumaService,
    private readonly queue: QueueService,
    private readonly tenants: TenantDbRunnerService,
  ) {}

  /** Installs or validates the immutable Core identity binding after session creation. */
  async bind(input: {
    tenantId: UUIDType;
    courseId: UUIDType;
    sessionId: UUIDType;
    actorId: UUIDType;
    language: CourseAuthoringContextRequest["language"];
    cursorSequence: number;
  }) {
    return this.repository.bind(input);
  }

  /** Persists and queues a live event hint without relying on a connected browser for durability. */
  async acceptRealtimeEvent(tenantId: UUIDType, value: unknown) {
    if (!value || typeof value !== "object") return;
    const event = value as Record<string, unknown>;
    if (event.type !== "context.requested") return;
    if (
      typeof event.eventId !== "string" ||
      typeof event.sequence !== "number" ||
      !Number.isInteger(event.sequence)
    )
      throw new Error("Invalid context request event");
    const request = CourseAuthoringContextBridgeService.parseContextRequest(event.payload);
    if (CourseAuthoringContextBridgeService.requestHash(request) !== request.requestHash)
      throw new Error("Context request hash does not match its payload");
    const binding = await this.repository.persistRealtimeRequest(tenantId, {
      eventId: event.eventId,
      sequence: event.sequence,
      request,
    });
    if (binding) await this.enqueueRequest(tenantId, request.contextRequestId);
  }

  /** Replays durable event pages and pending requests even when all browsers are disconnected. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollDisconnectedSessions() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      await this.tenants.runForEachTenant(async (tenantId) => {
        try {
          await this.tenants.runWithTenant(tenantId, async () => {
            const bindings = await this.repository.pollableBindings(
              tenantId,
              CourseAuthoringContextBridgeService.POLL_BATCH_SIZE,
            );
            for (const binding of bindings) {
              try {
                await this.pollBinding(binding);
              } catch {
                this.logger.warn("A context-request event page will be replayed on the next scan");
              } finally {
                await this.repository.touchPollTime(tenantId, binding.id);
              }
            }
            await this.enqueuePending(tenantId);
          });
        } catch {
          this.logger.warn("A tenant context scan will retry on the next interval");
        }
      });
    } catch {
      this.logger.warn("Course authoring context scan will retry on the next interval");
    } finally {
      this.scanning = false;
    }
  }

  private async pollBinding(binding: CourseAuthoringContextBinding) {
    const client = await this.luma.getLumaClient();
    const page = await client.authoring.getEvents({
      sessionId: binding.sessionId,
      afterSequence: binding.cursorSequence,
      limit: 100,
    });
    if (!Value.Check(authoringEventsSchema.properties.data, page))
      throw new Error("Invalid authoring event page");
    let lastSequence = binding.cursorSequence;
    for (const event of page.events) {
      if (event.sequence !== lastSequence + 1)
        throw new Error("Authoring event page is not contiguous with its cursor");
      lastSequence = event.sequence;
    }
    const requests = page.events
      .filter((event) => event.type === "context.requested")
      .map((event) => {
        const request = CourseAuthoringContextBridgeService.parseContextRequest(event.payload);
        if (CourseAuthoringContextBridgeService.requestHash(request) !== request.requestHash)
          throw new Error("Context request hash does not match its payload");
        if (
          request.sessionId !== binding.sessionId ||
          request.courseId !== binding.courseId ||
          request.language !== binding.language
        )
          throw new Error("Context request does not match its Core binding");
        return { eventId: event.eventId, sequence: event.sequence, request };
      });
    if (lastSequence > binding.cursorSequence || requests.length) {
      await this.repository.persistPage(binding, binding.cursorSequence, lastSequence, requests);
    }
  }

  private async enqueuePending(tenantId: UUIDType) {
    for (const request of await this.repository.pending(
      tenantId,
      CourseAuthoringContextBridgeService.ENQUEUE_BATCH_SIZE,
    )) {
      await this.enqueueRequest(tenantId, request.contextRequestId);
    }
  }

  private async enqueueRequest(tenantId: UUIDType, contextRequestId: UUIDType) {
    await this.queue.enqueue<CourseAuthoringContextFulfillmentJob>(
      QUEUE_NAMES.COURSE_AUTHORING_CONTEXT,
      "fulfill-context-request",
      { tenantId, contextRequestId },
      {
        jobId: `context-${tenantId}-${contextRequestId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  /** SHA-256 of compact UTF-8 JSON with recursively sorted object keys. */
  static responseHash(responseWithoutHash: Record<string, unknown>) {
    return this.canonicalHash(responseWithoutHash);
  }

  static requestHash(request: CourseAuthoringContextRequest) {
    const { contextRequestId: _contextRequestId, requestHash: _requestHash, ...payload } = request;
    return this.canonicalHash(payload);
  }

  static failureHash(failureWithoutHash: Record<string, unknown>) {
    return this.canonicalHash(failureWithoutHash);
  }

  /** Remove the event-only record envelope before validating the signed request contract. */
  private static parseContextRequest(value: unknown): CourseAuthoringContextRequest {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid context request event");
    const { record: _record, ...request } = value as Record<string, unknown>;
    if (!Value.Check(contextRequestSchema, request))
      throw new Error("Invalid context request event");
    return request as CourseAuthoringContextRequest;
  }

  private static canonicalHash(value: unknown) {
    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, item]) => [key, canonicalize(item)]),
      );
    };
    return createHash("sha256")
      .update(JSON.stringify(canonicalize(value)))
      .digest("hex");
  }
}
