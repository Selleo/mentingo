import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { tenants } from "src/storage/schema";

import { createUserFactory } from "../factory/user.factory";

import { cookieFor } from "./test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const INTEGRATION_ADMIN_PASSWORD = "Password123@@";

/**
 * Issues an integration key the way an admin does in account settings, from the default tenant.
 * `isManaging` marks that tenant as the managing tenant, so the key may act on other tenants.
 */
export async function issueIntegrationKey(params: {
  app: INestApplication;
  dbAdmin: DatabasePg;
  isManaging: boolean;
}) {
  const admin = await createUserFactory(params.dbAdmin)
    .withCredentials({ password: INTEGRATION_ADMIN_PASSWORD })
    .withAdminSettings(params.dbAdmin)
    .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

  await params.dbAdmin
    .update(tenants)
    .set({ isManaging: params.isManaging })
    .where(eq(tenants.id, admin.tenantId));

  const response = await request(params.app.getHttpServer())
    .post("/api/integration/key")
    .set("Cookie", await cookieFor(admin, params.app))
    .set("X-Forwarded-For", faker.internet.ipv4())
    .expect(201);

  return { admin, apiKey: response.body.data.key as string };
}
