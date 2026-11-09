import { faker } from "@faker-js/faker";
import { TENANT_STATUSES } from "@repo/shared";
import { Factory } from "fishery";

import { tenants } from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type TenantTest = InferSelectModel<typeof tenants>;

/** Creates tenants through the admin connection, since the tenants table is not tenant-scoped. */
export const createTenantFactory = (dbAdmin: DatabasePg) => {
  return Factory.define<TenantTest>(({ onCreate }) => {
    onCreate(async (tenant) => {
      const [inserted] = await dbAdmin.insert(tenants).values(tenant).returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      host: `https://${faker.string.alphanumeric(12).toLowerCase()}.tenant.local`,
      status: TENANT_STATUSES.ACTIVE,
      isManaging: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};
