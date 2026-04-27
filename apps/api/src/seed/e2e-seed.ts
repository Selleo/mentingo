import { drizzle } from "drizzle-orm/postgres-js/driver";
import postgres from "postgres";

import { seedUserRoleGrantSql } from "./seed-helpers";
import seedProduction from "./seed-prod";

import type { DatabasePg } from "src/common";

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql) as DatabasePg;

export async function seedE2E() {
  await seedUserRoleGrantSql(db);

  return seedProduction();
}

if (require.main === module) {
  seedE2E()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("An error occurred:", error);
      process.exit(1);
    });
}

export default seedE2E;
