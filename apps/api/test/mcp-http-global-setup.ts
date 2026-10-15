import path from "node:path";

import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { configureMcpHttpEnvironment } from "./mcp-http-environment";

export default async function mcpHttpGlobalSetup(): Promise<void> {
  configureMcpHttpEnvironment();
  const client = postgres(process.env.DATABASE_TEST_URL!, { max: 1, connect_timeout: 3 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.join(__dirname, "../src/storage/migrations"),
    });
  } finally {
    await client.end();
  }
  const storage = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  try {
    try {
      await storage.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET_NAME }));
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404)
        throw error;
      await storage.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET_NAME }));
    }
  } finally {
    storage.destroy();
  }
}
