import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConflictException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { CourseAuthoringApplicationRepository } from "src/luma/course-authoring-application.repository";
import { CourseAuthoringDraftRepository } from "src/luma/course-authoring-draft.repository";
import { createTenantAwareDb } from "src/storage/db/tenant-aware-session";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import * as schema from "src/storage/schema";

import type { CourseAuthoringApplicationClaim } from "src/luma/course-authoring.types";
import type { CourseAuthoringApplicationResult } from "src/storage/schema/course-authoring.schema";

// Deliberately separate from the normal developer/e2e database. The caller creates
// and removes a uniquely named empty database; this suite cannot target production.
const databaseUrl = process.env.AUTHORING_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("course authoring receipt transaction with native tenant DB", () => {
  let connection: ReturnType<typeof postgres>;
  let runner: TenantDbRunnerService;
  let repository: CourseAuthoringApplicationRepository;
  let drafts: CourseAuthoringDraftRepository;
  let injectedDb: ReturnType<typeof createTenantAwareDb>;
  const tenantId = randomUUID();
  const courseId = randomUUID();
  const ownerId = randomUUID();

  const claim = (): CourseAuthoringApplicationClaim => ({
    tenantId,
    courseId,
    sessionId: randomUUID(),
    exportId: randomUUID(),
    actorId: randomUUID(),
    exportHash: "a".repeat(64),
  });

  const result = (input: CourseAuthoringApplicationClaim): CourseAuthoringApplicationResult => ({
    applicationId: randomUUID(),
    courseId,
    sessionId: input.sessionId,
    exportId: input.exportId,
    exportHash: input.exportHash,
    status: "applied",
    appliedOperationIds: [],
    entityMappings: {},
    assetMappings: {},
  });

  beforeAll(async () => {
    if (!databaseUrl || !/^\/authoring_probe_[a-f0-9]+$/.test(new URL(databaseUrl).pathname)) {
      throw new Error("An explicitly created authoring_probe_<hex> scratch database is required");
    }
    connection = postgres(databaseUrl, { max: 10, onnotice: () => undefined });
    await connection.unsafe("CREATE TABLE tenants(id uuid PRIMARY KEY)");
    await connection.unsafe("CREATE TABLE courses(id uuid PRIMARY KEY)");
    await connection.unsafe("CREATE TABLE users(id uuid PRIMARY KEY)");
    await connection.unsafe("CREATE TABLE authoring_probe_writes(id uuid PRIMARY KEY)");
    for (const filename of [
      "0210_course_authoring_context_and_review.sql",
      "0211_course_authoring_tenant_isolation.sql",
      "0259_course_authoring_drafts.sql",
      "0260_course_authoring_draft_tenant_isolation.sql",
    ]) {
      const migration = await readFile(
        resolve(__dirname, "../../storage/migrations", filename),
        "utf8",
      );
      for (const statement of migration.split("--> statement-breakpoint")) {
        if (statement.trim()) await connection.unsafe(statement);
      }
    }
    await connection`INSERT INTO tenants(id) VALUES (${tenantId})`;
    await connection`INSERT INTO courses(id) VALUES (${courseId})`;
    await connection`INSERT INTO users(id) VALUES (${ownerId})`;
    const base = drizzle(connection, { schema });
    runner = new TenantDbRunnerService(base);
    injectedDb = createTenantAwareDb(base, runner);
    repository = new CourseAuthoringApplicationRepository(injectedDb);
    drafts = new CourseAuthoringDraftRepository(injectedDb);
  });

  afterAll(async () => {
    if (connection) await connection.end();
  });

  it("rolls back injected-service writes together with the receipt, then permits retry", async () => {
    const input = claim();
    const domainId = randomUUID();
    await expect(
      runner.runWithTenant(tenantId, () =>
        repository.applyOnce(input, async () => {
          await injectedDb.execute(
            sql`INSERT INTO authoring_probe_writes(id) VALUES (${domainId})`,
          );
          throw new Error("simulated later operation failure");
        }),
      ),
    ).rejects.toThrow("simulated later operation failure");
    expect(
      await connection`SELECT id FROM authoring_probe_writes WHERE id=${domainId}`,
    ).toHaveLength(0);
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.findReceipt(courseId, input.exportId, tenantId),
      ),
    ).toBeNull();

    const expected = result(input);
    await runner.runWithTenant(tenantId, () =>
      repository.applyOnce(input, async () => {
        await injectedDb.execute(sql`INSERT INTO authoring_probe_writes(id) VALUES (${domainId})`);
        return expected;
      }),
    );
    expect(
      await connection`SELECT id FROM authoring_probe_writes WHERE id=${domainId}`,
    ).toHaveLength(1);
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.findReceipt(courseId, input.exportId, tenantId),
      ),
    ).toEqual(expected);
  });

  it("serializes concurrent duplicate exports and refuses changed export identity", async () => {
    const input = claim();
    const expected = result(input);
    const domainId = randomUUID();
    let invocations = 0;
    const apply = async () => {
      invocations += 1;
      await injectedDb.execute(sql`INSERT INTO authoring_probe_writes(id) VALUES (${domainId})`);
      return expected;
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        runner.runWithTenant(tenantId, () => repository.applyOnce(input, apply)),
      ),
    );
    expect(invocations).toBe(1);
    expect(results.every((value) => value.applicationId === expected.applicationId)).toBe(true);
    await expect(
      runner.runWithTenant(tenantId, () =>
        repository.applyOnce({ ...input, exportHash: "b".repeat(64) }, apply),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(invocations).toBe(1);
  });

  it("stores receipts as JSON objects and finds failures when a newer export applied", async () => {
    const input = claim();
    const failure = {
      ...result(input),
      status: "failed" as const,
      reason: "courseAuthoring.errors.applicationFailed",
    };
    await runner.runWithTenant(tenantId, () => repository.recordFailureOnce(input, failure));
    const [stored] =
      await connection`SELECT jsonb_typeof(result) AS type FROM course_authoring_applications WHERE export_id=${input.exportId}`;
    expect(stored.type).toBe("object");
    const success = { ...claim(), sessionId: input.sessionId };
    await runner.runWithTenant(tenantId, () =>
      repository.applyOnce(success, async () => result(success)),
    );
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.latestTerminalSessionReceipt(tenantId, courseId, input.sessionId),
      ),
    ).toEqual(failure);
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.latestTerminalSessionReceipt(tenantId, courseId, randomUUID()),
      ),
    ).toBeNull();
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.latestTerminalSessionReceipt(randomUUID(), courseId, input.sessionId),
      ),
    ).toBeNull();
    const [applied] =
      await connection`SELECT jsonb_typeof(result) AS type FROM course_authoring_applications WHERE export_id=${success.exportId}`;
    expect(applied.type).toBe("object");
  });

  it("persists draft-only failures and serializes different exports for the same draft", async () => {
    const creation = { tenantId, ownerId, creationCommandId: randomUUID() };
    const [draft, retry] = await Promise.all([
      runner.runWithTenant(tenantId, () => drafts.open(creation)),
      runner.runWithTenant(tenantId, () => drafts.open(creation)),
    ]);
    expect(retry.id).toBe(draft.id);
    const sessionId = randomUUID();
    await runner.runWithTenant(tenantId, () => drafts.bindSession(tenantId, draft.id, sessionId));

    const input = (): CourseAuthoringApplicationClaim => ({
      ...claim(),
      courseId: draft.id,
      draftCourseId: draft.id,
      actorId: ownerId,
      sessionId,
    });
    const failed = input();
    const failure = { ...result(failed), courseId: draft.id, status: "failed" as const };
    await runner.runWithTenant(tenantId, () => repository.recordFailureOnce(failed, failure));
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.findReceipt(draft.id, failed.exportId, tenantId),
      ),
    ).toEqual(failure);

    let invocations = 0;
    const apply = (entry: CourseAuthoringApplicationClaim) =>
      runner.runWithTenant(tenantId, () =>
        repository.applyOnce(entry, async (transaction) => {
          const identity = { tenantId, placeholderCourseId: draft.id, sessionId, ownerId };
          await drafts.lockForCreation(identity, transaction);
          invocations += 1;
          await drafts.attachCourse(identity, courseId, transaction);
          return { ...result(entry), courseId: draft.id, entityMappings: { [draft.id]: courseId } };
        }),
      );
    const outcomes = await Promise.allSettled([apply(input()), apply(input())]);
    const successes = outcomes.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
    expect(invocations).toBe(1);
    expect(successes).toHaveLength(1);
    const [success] = successes;
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.findReceipt(courseId, success.exportId, tenantId),
      ),
    ).toEqual(success);
    expect(
      await runner.runWithTenant(tenantId, () =>
        repository.pendingSessionReceipts(tenantId, courseId, sessionId),
      ),
    ).toEqual([expect.objectContaining({ courseId: draft.id, exportId: success.exportId })]);
    expect(
      await runner.runWithTenant(tenantId, () => drafts.expire(tenantId, draft.id, new Date())),
    ).toBeNull();
  });

  it.each(["failed", "conflict", "applied"] as const)(
    "migrates legacy JSON-string %s receipts before reading them normally",
    async (status) => {
      const input = claim();
      const receipt = {
        ...result(input),
        status,
        reason: "courseAuthoring.errors.applicationFailed",
      };
      await runner.runWithTenant(tenantId, () =>
        injectedDb.insert(schema.courseAuthoringApplications).values({
          ...input,
          result: sql`${JSON.stringify(JSON.stringify(receipt))}::text::jsonb`,
        }),
      );
      expect(
        await runner.runWithTenant(tenantId, () =>
          repository.latestTerminalSessionReceipt(tenantId, courseId, input.sessionId),
        ),
      ).toBeNull();
      const migration = await readFile(
        resolve(__dirname, "../../storage/migrations/0223_normalize_course_authoring_receipts.sql"),
        "utf8",
      );
      await connection.unsafe(migration);
      // Replaying the backfill leaves already corrected receipts unchanged.
      await connection.unsafe(migration);
      expect(
        await runner.runWithTenant(tenantId, () =>
          repository.latestTerminalSessionReceipt(tenantId, courseId, input.sessionId),
        ),
      ).toEqual(status === "applied" ? null : receipt);
      expect(
        await runner.runWithTenant(tenantId, () =>
          repository.findReceipt(courseId, input.exportId, tenantId),
        ),
      ).toEqual(receipt);
      const [stored] =
        await connection`SELECT jsonb_typeof(result) AS type FROM course_authoring_applications WHERE export_id=${input.exportId}`;
      expect(stored.type).toBe("object");
    },
  );
});
