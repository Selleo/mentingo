import fs from "fs";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/storage/schema";

import type { DatabasePg } from "../src/common";

const CONFIG_FILE = "/tmp/test-containers.json";

let sql: ReturnType<typeof postgres>;
let db: DatabasePg;

export async function setupTestDatabase(): Promise<{
  db: DatabasePg;
  pgConnectionString: string;
  redisUrl: string;
}> {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      `Test containers config not found at ${CONFIG_FILE}. Make sure globalSetup ran successfully.`,
    );
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));

  sql = postgres(config.pgConnectionString);
  db = drizzle(sql, { schema }) as DatabasePg;

  process.env.DATABASE_URL = config.pgConnectionString;
  process.env.REDIS_URL = config.redisUrl;

  return {
    db,
    pgConnectionString: config.pgConnectionString,
    redisUrl: config.redisUrl,
  };
}

export async function closeTestDatabase() {
  if (sql) {
    try {
      await sql.end({ timeout: 5 });
    } catch (error) {
      console.error("Error closing SQL connection:", error);
    }
  }
}
