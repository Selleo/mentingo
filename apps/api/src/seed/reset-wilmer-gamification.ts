import * as dotenv from "dotenv";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  pointEvents,
  tenants,
  userAchievements,
  users,
  userStatistics,
} from "../storage/schema";

import type { DatabasePg } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

async function resolveTenantId(): Promise<string | null> {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    const [tenantByHost] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.host, corsOrigin))
      .limit(1);
    if (tenantByHost) return tenantByHost.id;
  }
  const [firstTenant] = await db.select().from(tenants).limit(1);
  return firstTenant?.id ?? null;
}

async function run() {
  try {
    const tenantId = await resolveTenantId();

    const wilmers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        tenantId
          ? and(eq(users.tenantId, tenantId), eq(users.firstName, "Wilmer"))
          : eq(users.firstName, "Wilmer"),
      );

    if (wilmers.length === 0) {
      console.log("No Wilmer user found.");
      return;
    }

    for (const wilmer of wilmers) {
      await db.delete(pointEvents).where(eq(pointEvents.userId, wilmer.id));
      await db.delete(userAchievements).where(eq(userAchievements.userId, wilmer.id));
      await db
        .update(userStatistics)
        .set({
          totalPoints: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastPointAt: null,
          lastActivityDate: null,
          activityHistory: {},
          updatedAt: sql`now()`,
        })
        .where(eq(userStatistics.userId, wilmer.id));
      console.log(`Reset gamification for ${wilmer.email}`);
    }
  } catch (error) {
    console.error("Reset failed:", error);
    process.exitCode = 1;
  } finally {
    await sqlConnect.end();
  }
}

if (require.main === module) {
  run()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error) => {
      console.error("An error occurred:", error);
      process.exit(1);
    });
}

export default run;
