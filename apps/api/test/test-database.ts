import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/storage/schema";

import type { DatabasePg } from "../src/common";

const getAppDatabaseUrl = (databaseUrl: string) => {
  if (process.env.LMS_DATABASE_TEST_URL) return process.env.LMS_DATABASE_TEST_URL;

  const url = new URL(databaseUrl);
  url.username = "lms_app_user";
  url.password = "replace_with_strong_password";

  return url.toString();
};

export async function setupTestDatabase(): Promise<{
  db: DatabasePg;
  sql: ReturnType<typeof postgres>;
  dbAdmin: DatabasePg;
  sqlAdmin: ReturnType<typeof postgres>;
  pgConnectionString: string;
  redisUrl: string;
}> {
  const pgConnectionString =
    process.env.DATABASE_TEST_URL ||
    "postgresql://postgres:guidebook@localhost:5432/guidebook_test";
  const pgAppConnectionString = getAppDatabaseUrl(pgConnectionString);
  const redisUrl = process.env.REDIS_TEST_URL || "redis://localhost:6379/1";

  const sql = postgres(pgAppConnectionString, { max: 10 });
  const db = drizzle(sql, { schema }) as DatabasePg;

  const sqlAdmin = postgres(pgConnectionString, { max: 10 });
  const dbAdmin = drizzle(sqlAdmin, { schema }) as DatabasePg;

  process.env.DATABASE_URL = pgConnectionString;
  process.env.REDIS_URL = redisUrl;

  return { db, sql, dbAdmin, sqlAdmin, pgConnectionString, redisUrl };
}
