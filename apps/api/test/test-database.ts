import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/storage/schema";

import type { DatabasePg } from "../src/common";

export async function setupTestDatabase(): Promise<{
  db: DatabasePg;
  sql: ReturnType<typeof postgres>;
  pgConnectionString: string;
  redisUrl: string;
}> {
  const pgConnectionString =
    process.env.DATABASE_TEST_URL || "postgresql://postgres:guidebook@localhost:5432/guidebook_test";
  const redisUrl = process.env.REDIS_TEST_URL || "redis://localhost:6379/1";

  const sql = postgres(pgConnectionString, { max: 10 });
  const db = drizzle(sql, { schema }) as DatabasePg;

  process.env.DATABASE_URL = pgConnectionString;
  process.env.REDIS_URL = redisUrl;

  return { db, sql, pgConnectionString, redisUrl };
}
