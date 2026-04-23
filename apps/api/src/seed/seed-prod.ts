import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS, type SystemRoleSlug } from "@repo/shared";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import hashPassword from "../common/helpers/hashPassword";
import { credentials, userDetails, users } from "../storage/schema";

import { insertGlobalSettings, insertOnboardingData, insertUserSettings } from "./seed";
import {
  assignSystemRoleToUser,
  ensureSeedTenant,
  seedSystemRolesForTenant,
  seedTruncateAllTables,
} from "./seed-helpers";

import type { DatabasePg, UUIDType } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sql = postgres(connectionString);
const db = drizzle(sql) as DatabasePg;

async function createOrFindUser(
  email: string,
  password: string,
  userData: any,
  roleSlug: SystemRoleSlug,
) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));

  if (existingUser) {
    if (roleSlug === SYSTEM_ROLE_SLUGS.ADMIN || roleSlug === SYSTEM_ROLE_SLUGS.CONTENT_CREATOR) {
      await insertUserDetailsIfMissing(existingUser.id, existingUser.tenantId, existingUser.email);
    }

    await assignSystemRoleToUser(db, existingUser.id, existingUser.tenantId, roleSlug);

    return existingUser;
  }

  const [newUser] = await db.insert(users).values(userData).returning();
  await insertCredential(newUser.id, userData.tenantId, password);
  await insertOnboardingData(newUser.id, userData.tenantId);

  if (roleSlug === SYSTEM_ROLE_SLUGS.ADMIN || roleSlug === SYSTEM_ROLE_SLUGS.CONTENT_CREATOR) {
    await insertUserDetailsIfMissing(newUser.id, userData.tenantId, newUser.email);
  }

  await assignSystemRoleToUser(db, newUser.id, userData.tenantId, roleSlug);

  return newUser;
}

async function insertUserDetailsIfMissing(userId: UUIDType, tenantId: UUIDType, email: string) {
  await db
    .insert(userDetails)
    .values({
      userId,
      tenantId,
      contactEmail: email,
    })
    .onConflictDoNothing({ target: userDetails.userId });
}

async function insertCredential(userId: UUIDType, tenantId: UUIDType, password: string) {
  const credentialData = {
    id: faker.string.uuid(),
    userId,
    password: await hashPassword(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId,
  };
  return (await db.insert(credentials).values(credentialData).returning())[0];
}

export async function seedProduction() {
  await seedTruncateAllTables(db);

  try {
    const tenant = await ensureSeedTenant(db, {
      name: "Default Tenant",
      host: process.env.CORS_ORIGIN ?? "localhost",
      isManaging: true,
    });

    const tenantId = tenant.id;
    await seedSystemRolesForTenant(db, tenantId);

    const adminUser = await createOrFindUser(
      "admin@example.com",
      "password",
      {
        id: faker.string.uuid(),
        email: "admin@example.com",
        firstName: faker.person.firstName(),
        lastName: "Admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId,
      },
      SYSTEM_ROLE_SLUGS.ADMIN,
    );
    console.log("Created or found admin user:", adminUser);
    const adminSettings = await insertUserSettings(db, adminUser.id, tenantId, true);
    console.log("Inserted admin user settings:", adminSettings);

    const studentUser = await createOrFindUser(
      "user@example.com",
      "password",
      {
        id: faker.string.uuid(),
        email: "user@example.com",
        firstName: faker.person.firstName(),
        lastName: "Student",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId,
      },
      SYSTEM_ROLE_SLUGS.STUDENT,
    );
    console.log("Created or found student user:", studentUser);
    const studentSettings = await insertUserSettings(db, studentUser.id, tenantId, false);
    console.log("Inserted student user settings:", studentSettings);

    const contentCreatorUser = await createOrFindUser(
      "contentcreator@example.com",
      "password",
      {
        id: faker.string.uuid(),
        email: "contentcreator@example.com",
        firstName: faker.person.firstName(),
        lastName: "Content Creator",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId,
      },
      SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    );
    console.log("Created or found content creator user:", contentCreatorUser);
    const contentCreatorSettings = await insertUserSettings(
      db,
      contentCreatorUser.id,
      tenantId,
      false,
    );
    console.log("Inserted content creator user settings:", contentCreatorSettings);

    const globalSettings = await insertGlobalSettings(db, tenantId);
    console.log("Inserted global settings:", globalSettings);

    console.log("Seeding completed successfully");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    console.log("Closing database connection");
    try {
      await sql.end();
      console.log("Database connection closed successfully.");
    } catch (error) {
      console.error("Error closing the database connection:", error);
    }
  }
}

if (require.main === module) {
  seedProduction()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("An error occurred:", error);
      process.exit(1);
    });
}

export default seedProduction;
