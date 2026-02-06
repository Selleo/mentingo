import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/storage/schema",
  out: "./src/storage/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.LMS_DATABASE_URL || process.env.DATABASE_URL) as string,
  },
  verbose: true,
  strict: true,
});
