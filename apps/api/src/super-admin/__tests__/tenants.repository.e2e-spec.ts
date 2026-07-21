import { randomUUID } from "node:crypto";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, inArray } from "drizzle-orm";

import { ACTIVITY_LOG_ACTION_TYPES } from "src/activity-logs/types";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { activityLogs, tenants, users } from "src/storage/schema";
import { TenantsRepository } from "src/super-admin/tenants.repository";
import { TenantsService } from "src/super-admin/tenants.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("TenantsRepository (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let repository: TenantsRepository;
  let service: TenantsService;
  let createdTenantIds: string[];

  const searchPrefix = `activity-summary-${randomUUID()}`;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    repository = app.get(TenantsRepository);
    service = app.get(TenantsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const tenantRecords = await dbAdmin
      .insert(tenants)
      .values([
        { name: `${searchPrefix}-active`, host: `https://${searchPrefix}-active.local` },
        {
          name: `${searchPrefix}-quiet`,
          host: `https://${searchPrefix}-quiet.local`,
          status: "inactive",
        },
        { name: `${searchPrefix}-empty`, host: `https://${searchPrefix}-empty.local` },
      ])
      .returning();

    createdTenantIds = tenantRecords.map((tenant) => tenant.id);

    const actorRecords = await dbAdmin
      .insert(users)
      .values([
        ...tenantRecords.slice(0, 2).map((tenant, index) => ({
          email: `activity-actor-${index}@example.com`,
          firstName: "Activity",
          lastName: `Actor ${index}`,
          tenantId: tenant.id,
        })),
        {
          email: "inactive-activity-actor@example.com",
          firstName: "Inactive",
          lastName: "Actor",
          tenantId: tenantRecords[0].id,
          archived: true,
        },
        {
          email: "non-active-user@example.com",
          firstName: "Non-active",
          lastName: "User",
          tenantId: tenantRecords[0].id,
        },
      ])
      .returning();

    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

    await dbAdmin.insert(activityLogs).values([
      {
        actorId: actorRecords[0].id,
        actorEmail: actorRecords[0].email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.CREATE,
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.CREATE },
        tenantId: tenantRecords[0].id,
        createdAt: daysAgo(14 + 1 / 24),
      },
      {
        actorId: actorRecords[0].id,
        actorEmail: actorRecords[0].email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE },
        tenantId: tenantRecords[0].id,
        createdAt: daysAgo(14 - 1 / 24),
      },
      {
        actorId: actorRecords[0].id,
        actorEmail: actorRecords[0].email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE },
        tenantId: tenantRecords[0].id,
        createdAt: daysAgo(1),
      },
      {
        actorId: actorRecords[1].id,
        actorEmail: actorRecords[1].email,
        actorRole: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        actionType: ACTIVITY_LOG_ACTION_TYPES.CREATE,
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.CREATE },
        tenantId: tenantRecords[1].id,
        createdAt: daysAgo(2),
      },
      {
        actorId: actorRecords[1].id,
        actorEmail: actorRecords[1].email,
        actorRole: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        actionType: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE },
        tenantId: tenantRecords[1].id,
        createdAt: daysAgo(20),
      },
      {
        actorId: actorRecords[1].id,
        actorEmail: actorRecords[1].email,
        actorRole: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        actionType: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        metadata: { operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE },
        tenantId: tenantRecords[1].id,
        createdAt: daysAgo(21),
      },
      ...[30, 31, 32].map((days, index) => ({
        actorId: actorRecords[0].id,
        actorEmail: actorRecords[0].email,
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType:
          index === 2 ? ACTIVITY_LOG_ACTION_TYPES.DELETE : ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        metadata: {
          operation:
            index === 2 ? ACTIVITY_LOG_ACTION_TYPES.DELETE : ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        },
        tenantId: tenantRecords[0].id,
        createdAt: daysAgo(days),
      })),
    ]);
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
    await dbAdmin.delete(tenants).where(inArray(tenants.id, createdTenantIds));
  });

  it("returns latest activity, 14-day trend, and active-user reach", async () => {
    const result = await repository.findAll({
      page: 1,
      perPage: 10,
      search: searchPrefix,
      currentTenantId: createdTenantIds[0],
    });

    const activeTenant = result.find((tenant) => tenant.id === createdTenantIds[0]);
    const quietTenant = result.find((tenant) => tenant.id === createdTenantIds[1]);
    const emptyTenant = result.find((tenant) => tenant.id === createdTenantIds[2]);

    expect(activeTenant).toMatchObject({
      isCurrentTenant: true,
      activityCountLast14Days: 2,
      activityTrendPercentage: 100,
      activeUsersLast14Days: 1,
      totalUsers: 2,
      lastActivity: {
        actorEmail: "activity-actor-0@example.com",
      },
      recentActivities: expect.arrayContaining([
        expect.objectContaining({
          actorEmail: "activity-actor-0@example.com",
          actionType: ACTIVITY_LOG_ACTION_TYPES.CREATE,
        }),
      ]),
    });
    expect(quietTenant).toMatchObject({
      activityCountLast14Days: 1,
      activityTrendPercentage: -50,
      activeUsersLast14Days: 1,
      totalUsers: 1,
      lastActivity: {
        actorEmail: "activity-actor-1@example.com",
      },
    });
    expect(emptyTenant).toMatchObject({
      activityCountLast14Days: 0,
      activityTrendPercentage: null,
      activeUsersLast14Days: 0,
      totalUsers: 0,
      lastActivity: null,
      recentActivities: [],
    });
    expect(activeTenant?.recentActivities).toHaveLength(5);
    expect(activeTenant?.recentActivities.map((activity) => activity.actionType)).toEqual([
      ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      ACTIVITY_LOG_ACTION_TYPES.CREATE,
      ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      ACTIVITY_LOG_ACTION_TYPES.UPDATE,
    ]);
  });

  it("sorts by latest activity in both directions and keeps empty tenants last", async () => {
    const newestFirst = await repository.findAll({
      page: 1,
      perPage: 10,
      search: searchPrefix,
      sort: "-lastActivity",
      currentTenantId: createdTenantIds[0],
    });
    const oldestFirst = await repository.findAll({
      page: 1,
      perPage: 10,
      search: searchPrefix,
      sort: "lastActivity",
      currentTenantId: createdTenantIds[0],
    });

    expect(newestFirst.map((tenant) => tenant.id)).toEqual(createdTenantIds);
    expect(oldestFirst.map((tenant) => tenant.id)).toEqual([
      createdTenantIds[1],
      createdTenantIds[0],
      createdTenantIds[2],
    ]);
  });

  it("sorts by recent activity count", async () => {
    const result = await repository.findAll({
      page: 1,
      perPage: 10,
      search: searchPrefix,
      sort: "-activityCountLast14Days",
      currentTenantId: createdTenantIds[0],
    });

    expect(result.map((tenant) => tenant.activityCountLast14Days)).toEqual([2, 1, 0]);
  });

  it("filters tenants and pagination counts by status", async () => {
    const [activeTenants, inactiveTenants, activeCount, inactiveCount] = await Promise.all([
      repository.findAll({
        page: 1,
        perPage: 10,
        search: searchPrefix,
        status: "active",
        currentTenantId: createdTenantIds[0],
      }),
      repository.findAll({
        page: 1,
        perPage: 10,
        search: searchPrefix,
        status: "inactive",
        currentTenantId: createdTenantIds[0],
      }),
      repository.countAll({ search: searchPrefix, status: "active" }),
      repository.countAll({ search: searchPrefix, status: "inactive" }),
    ]);

    expect(activeTenants).toHaveLength(2);
    expect(inactiveTenants.map((tenant) => tenant.id)).toEqual([createdTenantIds[1]]);
    expect(activeCount).toBe(2);
    expect(inactiveCount).toBe(1);
  });

  it("hard deletes a tenant and its tenant-scoped records", async () => {
    const tenantId = createdTenantIds[0];

    await service.deleteTenantById(tenantId, createdTenantIds[1]);

    const [deletedTenant, deletedUsers] = await Promise.all([
      repository.findById(tenantId),
      dbAdmin.select({ id: users.id }).from(users).where(eq(users.tenantId, tenantId)),
    ]);

    expect(deletedTenant).toBeNull();
    expect(deletedUsers).toEqual([]);
  });

  it("does not allow deleting the current tenant", async () => {
    const tenantId = createdTenantIds[0];

    await expect(service.deleteTenantById(tenantId, tenantId)).rejects.toMatchObject({
      message: "superAdminTenants.error.currentTenantDeleteNotAllowed",
    });

    await expect(repository.findById(tenantId)).resolves.not.toBeNull();
  });
});
