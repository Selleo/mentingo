/* eslint-disable no-console */
import fs from "fs";
import path from "path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { GenericContainer, Wait } from "testcontainers";

const CONFIG_FILE = "/tmp/test-containers.json";

export default async function globalSetup() {
  console.info("🚀 Starting shared test containers...");

  const [pgContainer, redisContainer] = await Promise.all([
    new GenericContainer("pgvector/pgvector:pg16")
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: "testdb",
        POSTGRES_USER: "testuser",
        POSTGRES_PASSWORD: "testpass",
      })
      .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections"))
      .start(),
    new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
      .start(),
  ]);

  const pgConnectionString = `postgresql://testuser:testpass@${pgContainer.getHost()}:${pgContainer.getMappedPort(
    5432,
  )}/testdb`;
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  console.info("📦 Containers started, running migrations...");

  const sql = postgres(pgConnectionString);
  const db = drizzle(sql);

  let migrationRetries = 0;
  const maxMigrationRetries = 5;

  while (migrationRetries < maxMigrationRetries) {
    try {
      await migrate(db, {
        migrationsFolder: path.join(__dirname, "../src/storage/migrations"),
      });
      console.info("✅ Migrations completed successfully");
      break;
    } catch (migrationError: any) {
      migrationRetries++;
      console.info(
        `Migration attempt ${migrationRetries}/${maxMigrationRetries} failed:`,
        migrationError.message,
      );

      if (migrationRetries >= maxMigrationRetries) {
        console.error("All migration attempts failed:", migrationError);
        throw migrationError;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  await sql.end();

  const config = {
    pgConnectionString,
    redisUrl,
    pgContainerId: pgContainer.getId(),
    redisContainerId: redisContainer.getId(),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  console.info("✅ Global setup complete. Config saved to", CONFIG_FILE);
}
