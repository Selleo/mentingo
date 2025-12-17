/* eslint-disable no-console */
import path from "path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function waitForPostgres(url: string, maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const sql = postgres(url, { connect_timeout: 2 });
      await sql`SELECT 1`;
      await sql.end();
      return;
    } catch (e: any) {
      if (attempt === maxAttempts) {
        throw new Error(
          `\n\n❌ PostgreSQL is not available at ${url}\n` +
            `   Make sure Docker containers are running:\n` +
            `   $ docker compose up -d\n\n`,
        );
      }
      console.info(`⏳ Waiting for PostgreSQL... (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export default async function globalSetup() {
  const mainDbUrl =
    process.env.DATABASE_URL || "postgresql://postgres:guidebook@localhost:5432/guidebook";
  const testDbUrl =
    process.env.DATABASE_TEST_URL ||
    "postgresql://postgres:guidebook@localhost:5432/guidebook_test";

  console.info("Setting up test database...");

  await waitForPostgres(mainDbUrl);

  const adminSql = postgres(mainDbUrl);
  try {
    await adminSql.unsafe(`CREATE DATABASE guidebook_test`);
    console.info("Created guidebook_test database");
  } catch (e: any) {
    if (!e.message.includes("already exists")) {
      await adminSql.end();
      throw e;
    }
    console.info("Database guidebook_test already exists");
  }
  await adminSql.end();

  const testSql = postgres(testDbUrl, { max: 1 });
  const db = drizzle(testSql);

  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "../src/storage/migrations"),
    });
    console.info("✅ Migrations completed successfully");
  } finally {
    await testSql.end();
  }

  console.info("✅ Test database ready");
}
