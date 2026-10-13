import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConflictException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { CourseAuthoringApplicationRepository } from "src/luma/course-authoring-application.repository";
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
  let injectedDb: ReturnType<typeof createTenantAwareDb>;
  const tenantId = randomUUID();
  const courseId = randomUUID();

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
    await connection.unsafe("CREATE TABLE authoring_probe_writes(id uuid PRIMARY KEY)");
    for (const filename of [
      "0201_course_authoring_applications.sql",
      "0202_course_authoring_applications_rls.sql",
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
    const base = drizzle(connection, { schema });
    runner = new TenantDbRunnerService(base);
    injectedDb = createTenantAwareDb(base, runner);
    repository = new CourseAuthoringApplicationRepository(injectedDb);
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
});
