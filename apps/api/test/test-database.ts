import path from "path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";

import * as schema from "../src/storage/schema";

import type { DatabasePg } from "../src/common";

let pgContainer: StartedTestContainer;
let sql: ReturnType<typeof postgres>;
let db: DatabasePg;

export async function setupTestDatabase(): Promise<{
  db: DatabasePg;
  pgContainer: StartedTestContainer;
  pgConnectionString: string;
}> {
  pgContainer = await new GenericContainer("postgres:16")
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_DB: "testdb",
      POSTGRES_USER: "testuser",
      POSTGRES_PASSWORD: "testpass",
    })
    .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections"))
    .start();

  const pgConnectionString = `postgresql://testuser:testpass@${pgContainer.getHost()}:${pgContainer.getMappedPort(
    5432,
  )}/testdb`;

  sql = postgres(pgConnectionString);
  db = drizzle(sql, { schema }) as DatabasePg;

  try {
    let migrationRetries = 0;
    const maxMigrationRetries = 5;

    while (migrationRetries < maxMigrationRetries) {
      try {
        await migrate(db, {
          migrationsFolder: path.join(__dirname, "../src/storage/migrations"),
        });
        console.log("Migrations completed successfully");
        break;
      } catch (migrationError) {
        migrationRetries++;
        console.log(
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
  } catch (migrationError) {
    console.error("Error running migrations:", migrationError);
    throw migrationError;
  }

  return { db, pgContainer, pgConnectionString };
}

export async function closeTestDatabase() {
  console.info("Attempting to close test database resources...");
  let pgSqlClosed = false;
  let pgContainerStopped = false;

  if (sql) {
    try {
      await sql.end({ timeout: 5 });
      pgSqlClosed = true;
      console.info("Postgres.js connection ended successfully.");
    } catch (sqlError) {
      console.error("Error ending postgres.js connection:", sqlError);
    }
  } else {
    pgSqlClosed = true;
  }

  if (pgContainer) {
    try {
      await pgContainer.stop({ timeout: 10000 });
      pgContainerStopped = true;
      console.info("PostgreSQL test container stopped successfully.");
    } catch (containerError) {
      console.error("Error stopping PostgreSQL test container:", containerError);
    }
  } else {
    pgContainerStopped = true;
  }

  console.info(
    `Resource cleanup status: pgSqlClosed=${pgSqlClosed}, pgContainerStopped=${pgContainerStopped}`,
  );
}
