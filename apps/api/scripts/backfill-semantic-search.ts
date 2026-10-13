/* eslint-disable no-console */
import { ConfigService } from "@nestjs/config";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { SemanticSearchIndexQueueService } from "src/global-search/semantic-search-index.queue.service";
import { SemanticSearchIndexRepository } from "src/global-search/semantic-search-index.repository";
import { QueueService } from "src/queue/queue.service";
import { createTenantAwareDb } from "src/storage/db/tenant-aware-session";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import * as schema from "src/storage/schema";

import type { DatabasePg } from "src/common";

/** Defaults to a dry run. Re-run after workers drain; unchanged completed sources are skipped. */
async function main() {
  dotenv.config();
  const args = process.argv.slice(2);
  const argument = (name: string) => args[args.indexOf(name) + 1];
  const tenantId = args.includes("--tenant") ? argument("--tenant") : undefined;
  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error("Provide --tenant <UUID>");
  const limit = args.includes("--limit") ? Number(argument("--limit")) : 50;
  let offset = args.includes("--offset") ? Number(argument("--offset")) : 0;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 500 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    throw new Error("Use --limit 1..500 and nonnegative --offset");
  }
  const batches = args.includes("--batches") ? Number(argument("--batches")) : 1;
  if (!Number.isInteger(batches) || batches < 1 || batches > 100)
    throw new Error("Use --batches 1..100");
  const url = process.env.LMS_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("LMS_DATABASE_URL or DATABASE_URL is required");
  const pg = postgres(url, { max: 2 });
  const db = drizzle(pg, { schema }) as DatabasePg;
  const runner = new TenantDbRunnerService(db);
  const scopedDb = createTenantAwareDb(db, runner);
  const queue = new QueueService(
    new ConfigService({ redis: { REDIS_URL: process.env.REDIS_URL } }),
  );
  try {
    if (args.includes("--apply")) queue.onModuleInit();
    const service = new SemanticSearchIndexQueueService(
      new SemanticSearchIndexRepository(scopedDb),
      queue,
    );
    for (let batch = 0; batch < batches; batch++) {
      const result = await runner.runWithTenant(tenantId, () =>
        service.reconcile(tenantId, {
          dryRun: !args.includes("--apply"),
          limit,
          offset,
        }),
      );
      console.log({
        tenantId,
        mode: args.includes("--apply") ? "enqueue" : "dry-run",
        offset,
        limit,
        ...result,
      });
      if (result.pending < limit) break;
      offset += result.pending;
    }
  } finally {
    await queue.onModuleDestroy();
    await pg.end();
  }
}

main().catch(() => {
  console.error("Semantic search backfill failed; check configuration and migrated schema");
  process.exitCode = 1;
});
