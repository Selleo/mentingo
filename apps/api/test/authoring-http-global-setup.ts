import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseNamePattern = /^\/authoring_probe_[a-f0-9]+$/;

function getRequiredEnvironment(): string {
  const databaseUrl = process.env.AUTHORING_TEST_DATABASE_URL;
  const testDatabaseUrl = process.env.DATABASE_TEST_URL;
  const aiBaseUrl = process.env.AUTHORING_AI_BASE_URL;
  const aiApiKey = process.env.AUTHORING_AI_API_KEY;

  if (!databaseUrl || !testDatabaseUrl || !aiBaseUrl || !aiApiKey) {
    throw new Error(
      "Authoring HTTP tests require AUTHORING_TEST_DATABASE_URL, matching DATABASE_TEST_URL, AUTHORING_AI_BASE_URL, and AUTHORING_AI_API_KEY",
    );
  }

  const databasePath = new URL(databaseUrl).pathname;
  if (!databaseNamePattern.test(databasePath) || databaseUrl !== testDatabaseUrl) {
    throw new Error(
      "Authoring HTTP tests require AUTHORING_TEST_DATABASE_URL and DATABASE_TEST_URL to match an authoring_probe_<hex> database",
    );
  }

  const aiUrl = new URL(aiBaseUrl);
  if (aiUrl.protocol !== "http:" && aiUrl.protocol !== "https:") {
    throw new Error("AUTHORING_AI_BASE_URL must use HTTP or HTTPS");
  }

  return databaseUrl;
}

async function waitForDatabase(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { connect_timeout: 3, max: 1 });

  try {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await client`SELECT 1`;
        return;
      } catch (error) {
        if (attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  } finally {
    await client.end();
  }
}

export default async function authoringHttpGlobalSetup(): Promise<void> {
  const databaseUrl = getRequiredEnvironment();

  await waitForDatabase(databaseUrl);

  const client = postgres(databaseUrl, { max: 1 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.join(__dirname, "../src/storage/migrations"),
    });
  } finally {
    await client.end();
  }
}
