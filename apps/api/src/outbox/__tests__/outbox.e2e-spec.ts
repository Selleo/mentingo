import { faker } from "@faker-js/faker";
import { Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { NativeArchiveExportedEvent } from "src/events";
import { NativeArchiveImportFinishedEvent } from "src/native-archive/events/native-archive-import-finished.event";
import {
  NATIVE_ARCHIVE_EXPORT_ACCESS,
  NATIVE_ARCHIVE_IMPORT_OUTCOMES,
  NATIVE_ARCHIVE_KIND,
} from "src/native-archive/native-archive.constants";
import { OutboxDispatcherService } from "src/outbox/outbox-dispatcher.service";
import { OUTBOX_ABANDONED_CLAIM_ERROR, OUTBOX_MAX_ATTEMPTS } from "src/outbox/outbox.constants";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { OutboxRepository } from "src/outbox/outbox.repository";
import { OUTBOX_STATUSES } from "src/outbox/outbox.types";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { outboxEvents, tenants } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createTenantFactory } from "../../../test/factory/tenant.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  CONCURRENT_CLAIM_CASES,
  RETRY_DELAY_ELAPSED_SECONDS,
  INVALID_IMPORT_OUTCOME,
  LONGEST_RETRY_DELAY_ELAPSED_SECONDS,
  NON_MARKETPLACE_IMPORT_SOURCE,
  OUTBOX_PAYLOAD_RETENTIONS,
  OUTBOX_TABLES,
  PUBLICATION_CASES,
  PUBLISHED_PAYLOAD_CASES,
  SECOND_RETRY_DELAY_ELAPSED_SECONDS,
  STALLED_CLAIM_ELAPSED_SECONDS,
  TRANSACTION_OUTCOMES,
} from "./outbox.scenarios";

import type { OutboxPayloadRetention } from "./outbox.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { OutboxEventsHandlerOf, OutboxStatus } from "src/outbox/outbox.types";

type ExportedEventDelivery = { rootId: UUIDType; tenantId: string | null };

/** A write no handler reacts to, so a row of it left in the outbox can only come from the probe. */
class ProbeWrittenEvent {
  constructor(public readonly probeWriteData: { rootId: UUIDType }) {}
}

/** Records what the dispatcher delivers for one event type, and fails on request. */
@Injectable()
@OutboxEventsHandler(NativeArchiveExportedEvent)
class ExportedEventProbe implements OutboxEventsHandlerOf<NativeArchiveExportedEvent> {
  readonly deliveries: ExportedEventDelivery[] = [];
  private failure: Error | null = null;
  private writesBeforeFailing = false;

  constructor(private readonly outboxPublisher: OutboxPublisher) {}

  async handleOutboxEvent({ archiveExport }: NativeArchiveExportedEvent) {
    this.deliveries.push({
      rootId: archiveExport.rootId,
      tenantId: dbAls.getStore()?.tenantId ?? null,
    });

    if (this.writesBeforeFailing)
      await this.outboxPublisher.publish(new ProbeWrittenEvent({ rootId: archiveExport.rootId }));

    if (this.failure) throw this.failure;
  }

  failWith(error: Error) {
    this.failure = error;
  }

  /** Writes to the database inside its delivery, then fails. */
  failAfterWriting(error: Error) {
    this.writesBeforeFailing = true;
    this.failWith(error);
  }

  stopFailing() {
    this.failure = null;
    this.writesBeforeFailing = false;
  }

  reset() {
    this.deliveries.length = 0;
    this.stopFailing();
  }
}

/** A second handler of the same event that always succeeds, to see what a retry runs again. */
@Injectable()
@OutboxEventsHandler(NativeArchiveExportedEvent)
class ExportedEventCounter implements OutboxEventsHandlerOf<NativeArchiveExportedEvent> {
  deliveryCount = 0;

  async handleOutboxEvent() {
    this.deliveryCount++;
  }
}

describe("Outbox (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;
  let otherTenantId: UUIDType;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let outboxPublisher: OutboxPublisher;
  let outboxRepository: OutboxRepository;
  let outboxDispatcherService: OutboxDispatcherService;
  let tenantDbRunnerService: TenantDbRunnerService;
  let exportedEventProbe: ExportedEventProbe;
  let exportedEventCounter: ExportedEventCounter;

  beforeAll(async () => {
    const test = await createE2ETest({
      customProviders: [ExportedEventProbe, ExportedEventCounter],
      useDbProxy: true,
    });

    app = test.app;
    db = test.db;
    dbAdmin = test.dbAdmin;
    defaultTenantId = test.defaultTenantId;
    runAsTenant = test.runAsTenant;
    outboxPublisher = app.get(OutboxPublisher);
    outboxRepository = app.get(OutboxRepository);
    outboxDispatcherService = app.get(OutboxDispatcherService);
    tenantDbRunnerService = app.get(TenantDbRunnerService);
    exportedEventProbe = app.get(ExportedEventProbe);
    exportedEventCounter = app.get(ExportedEventCounter);

    otherTenantId = (await createTenantFactory(dbAdmin).create()).id;
  });

  beforeEach(async () => {
    await truncateTables(db, [...OUTBOX_TABLES]);
    exportedEventProbe.reset();
    exportedEventCounter.deliveryCount = 0;
  });

  afterEach(async () => {
    await truncateTables(db, [...OUTBOX_TABLES]);
  });

  afterAll(async () => {
    await dbAdmin.delete(tenants).where(eq(tenants.id, otherTenantId));
    await app.close();
  });

  const buildExportedEvent = (tenantId: UUIDType, rootId: UUIDType = faker.string.uuid()) =>
    new NativeArchiveExportedEvent({
      actor: {
        userId: faker.string.uuid(),
        email: faker.internet.email(),
        roleSlugs: [],
        permissions: [],
        tenantId,
      },
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId,
      exportAccess: NATIVE_ARCHIVE_EXPORT_ACCESS.ACTOR_PERMISSIONS,
    });

  const publishExportedEvent = (tenantId: UUIDType, rootId?: UUIDType) =>
    runAsTenant(tenantId, () => outboxPublisher.publish(buildExportedEvent(tenantId, rootId)));

  const buildImportFinishedEvent = (
    tenantId: UUIDType,
    outcome: string = NATIVE_ARCHIVE_IMPORT_OUTCOMES.IMPORTED,
  ) =>
    new NativeArchiveImportFinishedEvent({
      tenantId,
      jobId: faker.string.numeric(4),
      actorId: faker.string.uuid(),
      outcome: outcome as never,
      courseId: null,
      failureCode: null,
      importSource: NON_MARKETPLACE_IMPORT_SOURCE,
      finishedAt: new Date().toISOString(),
    });

  const publishImportFinishedEvent = (tenantId: UUIDType, outcome?: string) =>
    runAsTenant(tenantId, () =>
      outboxPublisher.publish(buildImportFinishedEvent(tenantId, outcome)),
    );

  const publishEventWith = (payloadRetention: OutboxPayloadRetention) =>
    match(payloadRetention)
      .with(OUTBOX_PAYLOAD_RETENTIONS.CLEARED, () => publishImportFinishedEvent(defaultTenantId))
      .with(OUTBOX_PAYLOAD_RETENTIONS.KEPT, () => publishExportedEvent(defaultTenantId))
      .exhaustive();

  const findOutboxEvents = () => dbAdmin.select().from(outboxEvents);

  const findOnlyOutboxEvent = async () => {
    const [outboxEvent, ...otherEvents] = await findOutboxEvents();

    expect(otherEvents).toHaveLength(0);

    return outboxEvent;
  };

  /** Moves an event's last update into the past, as if that much time had passed since. */
  const backdateOutboxEvent = (
    id: string,
    elapsedSeconds: number,
    changes: { status?: OutboxStatus; attemptCount?: number } = {},
  ) =>
    dbAdmin
      .update(outboxEvents)
      .set({
        ...changes,
        updatedAt: sql`NOW() - make_interval(secs => ${elapsedSeconds})`,
      })
      .where(eq(outboxEvents.id, id));

  const dispatchOutbox = () => outboxDispatcherService.dispatchPendingEvents();

  const publishEventWithFailingHandler = () => {
    exportedEventProbe.failWith(new Error("handler failed by test"));

    return publishExportedEvent(defaultTenantId);
  };

  /** Dispatches once, then lets any retry delay pass so the next dispatch may claim it again. */
  const dispatchAndWaitOutRetryDelay = async (id: string) => {
    await dispatchOutbox();
    await backdateOutboxEvent(id, LONGEST_RETRY_DELAY_ELAPSED_SECONDS);
  };

  describe("publishing", () => {
    it.each(PUBLICATION_CASES)(
      "stores $expectedRowCount event(s) when the publishing transaction is $transactionOutcome",
      async ({ transactionOutcome, expectedRowCount }) => {
        const rollback = new Error("rolled back by test");

        await runAsTenant(defaultTenantId, () =>
          tenantDbRunnerService.transactionWithHandle(async (transaction) => {
            await outboxPublisher.publish(buildExportedEvent(defaultTenantId), transaction);

            if (transactionOutcome === TRANSACTION_OUTCOMES.ROLLED_BACK) throw rollback;
          }),
        ).catch((error: unknown) => {
          if (error !== rollback) throw error;
        });

        expect(await findOutboxEvents()).toHaveLength(expectedRowCount);
      },
    );

    it("stores a published event as pending with its type, payload and tenant", async () => {
      const rootId = faker.string.uuid();

      await publishExportedEvent(defaultTenantId, rootId);

      expect(await findOnlyOutboxEvent()).toMatchObject({
        eventType: NativeArchiveExportedEvent.name,
        status: OUTBOX_STATUSES.PENDING,
        attemptCount: 0,
        tenantId: defaultTenantId,
        payload: { archiveExport: expect.objectContaining({ rootId }) },
      });
    });
  });

  describe("claiming", () => {
    it.each(CONCURRENT_CLAIM_CASES)(
      "never claims any of $pendingEventCount pending event(s) twice under concurrent claims",
      async ({ pendingEventCount }) => {
        for (let index = 0; index < pendingEventCount; index++)
          await publishExportedEvent(defaultTenantId);

        const claims = await runAsTenant(defaultTenantId, () =>
          Promise.all([
            outboxRepository.claimNextDueEvent(defaultTenantId),
            outboxRepository.claimNextDueEvent(defaultTenantId),
          ]),
        );
        const claimedIds = claims.flatMap((claim) => (claim ? [claim.id] : []));

        expect(claimedIds.length).toBeGreaterThanOrEqual(1);
        expect(new Set(claimedIds).size).toBe(claimedIds.length);
      },
    );

    it("claims exactly the one event it returns", async () => {
      for (let index = 0; index < 3; index++) await publishExportedEvent(defaultTenantId);

      const claim = await runAsTenant(defaultTenantId, () =>
        outboxRepository.claimNextDueEvent(defaultTenantId),
      );
      const processingEvents = await dbAdmin
        .select({ id: outboxEvents.id })
        .from(outboxEvents)
        .where(eq(outboxEvents.status, OUTBOX_STATUSES.PROCESSING));

      expect(processingEvents).toEqual([{ id: claim?.id }]);
    });

    it("claims only events of the tenant it runs for", async () => {
      await publishExportedEvent(otherTenantId);

      const claim = await runAsTenant(defaultTenantId, () =>
        outboxRepository.claimNextDueEvent(defaultTenantId),
      );

      expect(claim).toBeNull();
    });

    it("waits before claiming a failed event-bus event again", async () => {
      await publishExportedEvent(defaultTenantId);

      const reclaimed = await runAsTenant(defaultTenantId, async () => {
        const claim = await outboxRepository.claimNextDueEvent(defaultTenantId);

        if (!claim) throw new Error("Expected a pending event to claim");

        await outboxRepository.recordFailedAttempt(claim, {
          status: OUTBOX_STATUSES.FAILED,
          attemptCount: claim.attemptCount + 1,
          lastError: "failed by test",
        });

        return outboxRepository.claimNextDueEvent(defaultTenantId);
      });

      expect(reclaimed).toBeNull();
    });

    it("never claims a dead event again", async () => {
      await publishExportedEvent(defaultTenantId);

      const reclaimed = await runAsTenant(defaultTenantId, async () => {
        const claim = await outboxRepository.claimNextDueEvent(defaultTenantId);

        if (!claim) throw new Error("Expected a pending event to claim");

        await outboxRepository.recordFailedAttempt(claim, {
          status: OUTBOX_STATUSES.DEAD,
          attemptCount: OUTBOX_MAX_ATTEMPTS,
          lastError: "failed by test",
        });
        await backdateOutboxEvent(claim.id, RETRY_DELAY_ELAPSED_SECONDS);

        return outboxRepository.claimNextDueEvent(defaultTenantId);
      });

      expect(reclaimed).toBeNull();
    });

    it("refuses a stale claim once another dispatcher took the event over", async () => {
      await publishExportedEvent(defaultTenantId);

      const locks = await runAsTenant(defaultTenantId, async () => {
        const staleClaim = await outboxRepository.claimNextDueEvent(defaultTenantId);

        if (!staleClaim) throw new Error("Expected a pending event to claim");

        await backdateOutboxEvent(staleClaim.id, STALLED_CLAIM_ELAPSED_SECONDS);
        await outboxRepository.releaseStalledClaims(defaultTenantId);
        await backdateOutboxEvent(staleClaim.id, RETRY_DELAY_ELAPSED_SECONDS);
        const currentClaim = await outboxRepository.claimNextDueEvent(defaultTenantId);

        if (!currentClaim) throw new Error("Expected the released event to be claimed again");

        return tenantDbRunnerService.transactionWithHandle(async () => ({
          staleClaim: await outboxRepository.lockClaimedEvent(staleClaim),
          currentClaim: await outboxRepository.lockClaimedEvent(currentClaim),
        }));
      });

      expect(locks).toEqual({ staleClaim: null, currentClaim: { succeededHandlers: [] } });
    });

    it("ignores writes made under a claim that was released as stalled", async () => {
      await publishExportedEvent(defaultTenantId);

      await runAsTenant(defaultTenantId, async () => {
        const staleClaim = await outboxRepository.claimNextDueEvent(defaultTenantId);

        if (!staleClaim) throw new Error("Expected a pending event to claim");

        await backdateOutboxEvent(staleClaim.id, STALLED_CLAIM_ELAPSED_SECONDS);
        await outboxRepository.releaseStalledClaims(defaultTenantId);
        await outboxRepository.recordFailedAttempt(staleClaim, {
          status: OUTBOX_STATUSES.FAILED,
          attemptCount: staleClaim.attemptCount + 1,
          lastError: "late write by test",
        });
      });

      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.FAILED,
        attemptCount: 1,
        lastError: OUTBOX_ABANDONED_CLAIM_ERROR,
        claimId: null,
      });
    });

    it("leaves a stalled claim alone while a running handler has it locked", async () => {
      await publishExportedEvent(defaultTenantId);
      const { id } = await findOnlyOutboxEvent();
      await backdateOutboxEvent(id, STALLED_CLAIM_ELAPSED_SECONDS, {
        status: OUTBOX_STATUSES.PROCESSING,
      });

      await dbAdmin.transaction(async (transaction) => {
        await transaction
          .select({ id: outboxEvents.id })
          .from(outboxEvents)
          .where(eq(outboxEvents.id, id))
          .for("update");

        await runAsTenant(defaultTenantId, () =>
          outboxRepository.releaseStalledClaims(defaultTenantId),
        );
      });

      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.PROCESSING,
        attemptCount: 0,
      });
    });
  });

  describe("delivery", () => {
    it("delivers a pending event to its handler and marks it published", async () => {
      const rootId = faker.string.uuid();
      await publishExportedEvent(defaultTenantId, rootId);

      await dispatchOutbox();

      expect(exportedEventProbe.deliveries).toEqual([{ rootId, tenantId: defaultTenantId }]);
      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.PUBLISHED,
        publishedAt: expect.any(String),
      });
    });

    it("delivers each tenant's events inside that tenant's context", async () => {
      const defaultTenantRootId = faker.string.uuid();
      const otherTenantRootId = faker.string.uuid();
      await publishExportedEvent(defaultTenantId, defaultTenantRootId);
      await publishExportedEvent(otherTenantId, otherTenantRootId);

      await dispatchOutbox();

      expect(exportedEventProbe.deliveries).toEqual(
        expect.arrayContaining([
          { rootId: defaultTenantRootId, tenantId: defaultTenantId },
          { rootId: otherTenantRootId, tenantId: otherTenantId },
        ]),
      );
    });

    it("keeps an event unpublished when its handler fails", async () => {
      await publishEventWithFailingHandler();

      await dispatchOutbox();

      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.FAILED,
        attemptCount: 1,
        lastError: expect.stringContaining("ExportedEventProbe: handler failed by test"),
      });
    });

    it("rolls back what a failing handler wrote to the database", async () => {
      exportedEventProbe.failAfterWriting(new Error("handler failed by test"));
      await publishExportedEvent(defaultTenantId);

      await dispatchOutbox();

      expect(await findOutboxEvents()).toEqual([
        expect.objectContaining({
          eventType: NativeArchiveExportedEvent.name,
          status: OUTBOX_STATUSES.FAILED,
        }),
      ]);
    });

    it("retries a failed event only after its retry delay", async () => {
      await publishEventWithFailingHandler();
      await dispatchOutbox();
      const { id } = await findOnlyOutboxEvent();

      await dispatchOutbox();
      const beforeDelay = await findOnlyOutboxEvent();
      await backdateOutboxEvent(id, RETRY_DELAY_ELAPSED_SECONDS);
      await dispatchOutbox();
      const afterDelay = await findOnlyOutboxEvent();

      expect({ beforeDelay, afterDelay }).toMatchObject({
        beforeDelay: { attemptCount: 1 },
        afterDelay: { attemptCount: 2 },
      });
    });

    it("waits longer before each further retry", async () => {
      await publishEventWithFailingHandler();
      await dispatchOutbox();
      const { id } = await findOnlyOutboxEvent();
      await backdateOutboxEvent(id, RETRY_DELAY_ELAPSED_SECONDS);
      await dispatchOutbox();

      await backdateOutboxEvent(id, RETRY_DELAY_ELAPSED_SECONDS);
      await dispatchOutbox();
      const beforeDelay = await findOnlyOutboxEvent();
      await backdateOutboxEvent(id, SECOND_RETRY_DELAY_ELAPSED_SECONDS);
      await dispatchOutbox();
      const afterDelay = await findOnlyOutboxEvent();

      expect({ beforeDelay, afterDelay }).toMatchObject({
        beforeDelay: { attemptCount: 2 },
        afterDelay: { attemptCount: 3 },
      });
    });

    it("retries only the handlers that failed", async () => {
      await publishEventWithFailingHandler();
      const { id } = await findOnlyOutboxEvent();
      await dispatchAndWaitOutRetryDelay(id);

      exportedEventProbe.stopFailing();
      await dispatchOutbox();

      expect({
        probeDeliveries: exportedEventProbe.deliveries.length,
        counterDeliveries: exportedEventCounter.deliveryCount,
        outboxEvent: await findOnlyOutboxEvent(),
      }).toMatchObject({
        probeDeliveries: 2,
        counterDeliveries: 1,
        outboxEvent: { status: OUTBOX_STATUSES.PUBLISHED, attemptCount: 1 },
      });
    });

    it("marks an event dead on its last allowed attempt", async () => {
      await publishEventWithFailingHandler();
      const { id } = await findOnlyOutboxEvent();

      for (let attempt = 0; attempt < OUTBOX_MAX_ATTEMPTS; attempt++)
        await dispatchAndWaitOutRetryDelay(id);
      await dispatchOutbox();

      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.DEAD,
        attemptCount: OUTBOX_MAX_ATTEMPTS,
      });
    });

    it("counts a stalled claim as a failed attempt and delivers it after the retry delay", async () => {
      const rootId = faker.string.uuid();
      await publishExportedEvent(defaultTenantId, rootId);
      const { id } = await findOnlyOutboxEvent();
      await backdateOutboxEvent(id, STALLED_CLAIM_ELAPSED_SECONDS, {
        status: OUTBOX_STATUSES.PROCESSING,
      });

      await dispatchOutbox();
      const released = await findOnlyOutboxEvent();
      await backdateOutboxEvent(id, RETRY_DELAY_ELAPSED_SECONDS);
      await dispatchOutbox();

      expect(released).toMatchObject({
        status: OUTBOX_STATUSES.FAILED,
        attemptCount: 1,
        lastError: OUTBOX_ABANDONED_CLAIM_ERROR,
      });
      expect(exportedEventProbe.deliveries).toEqual([{ rootId, tenantId: defaultTenantId }]);
      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.PUBLISHED,
      });
    });

    it("marks a claim that keeps stalling dead on its last allowed attempt", async () => {
      await publishExportedEvent(defaultTenantId);
      const { id } = await findOnlyOutboxEvent();
      await backdateOutboxEvent(id, STALLED_CLAIM_ELAPSED_SECONDS, {
        status: OUTBOX_STATUSES.PROCESSING,
        attemptCount: OUTBOX_MAX_ATTEMPTS - 1,
      });

      await dispatchOutbox();

      expect(exportedEventProbe.deliveries).toEqual([]);
      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.DEAD,
        attemptCount: OUTBOX_MAX_ATTEMPTS,
      });
    });

    it.each(PUBLISHED_PAYLOAD_CASES)(
      "keeps the payload of a published event whose payload is $payloadRetention: $keepsPayload",
      async ({ payloadRetention, keepsPayload }) => {
        await publishEventWith(payloadRetention);
        const { payload } = await findOnlyOutboxEvent();

        await dispatchOutbox();

        expect(await findOnlyOutboxEvent()).toMatchObject({
          status: OUTBOX_STATUSES.PUBLISHED,
          payload: keepsPayload ? payload : {},
        });
      },
    );
  });

  describe("payload validation", () => {
    it("marks an event whose payload fails its schema dead at once", async () => {
      await publishImportFinishedEvent(defaultTenantId, INVALID_IMPORT_OUTCOME);

      await dispatchOutbox();

      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.DEAD,
        attemptCount: 1,
        lastError: `Invalid ${NativeArchiveImportFinishedEvent.name} payload`,
      });
    });

    it("delivers a flat payload stored by an older API instance instead of marking it dead", async () => {
      const { importFinishedData } = buildImportFinishedEvent(defaultTenantId);
      await runAsTenant(defaultTenantId, () =>
        outboxRepository.createPending({
          eventType: NativeArchiveImportFinishedEvent.name,
          payload: importFinishedData,
        }),
      );

      await dispatchOutbox();

      expect(await findOnlyOutboxEvent()).toMatchObject({
        status: OUTBOX_STATUSES.PUBLISHED,
        lastError: null,
      });
    });
  });
});
