import { randomUUID } from "node:crypto";

import { PERMISSIONS } from "@repo/shared";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { GroupService } from "src/group/group.service";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxNotificationPreparationService } from "src/outbox/outbox-notification-preparation.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { OutboxRepository } from "src/outbox/outbox.repository";

import type { EventBus } from "@nestjs/cqrs";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CourseService } from "src/courses/course.service";
import type { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import type { PermissionsService } from "src/permissions/permissions.service";

// Opt-in, disposable PostgreSQL only. No shared database or application services are used.
const url = process.env.GROUP_ASSIGNMENT_TEST_DATABASE_URL;
const persistence = url ? describe : describe.skip;
persistence("Group assignment PostgreSQL/outbox persistence", () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const userId = randomUUID();
  const groupId = randomUUID();
  const foreignGroupId = randomUUID();
  let client: ReturnType<typeof postgres>;
  let service: GroupService;
  let outboxRepository: OutboxRepository;

  beforeAll(async () => {
    if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
      throw new Error("Use a disposable local database");
    client = postgres(url);
    const schema = `group_assignment_${randomUUID().replaceAll("-", "")}`;
    await client.unsafe(`CREATE SCHEMA ${schema}`);
    await client.unsafe(`SET search_path TO ${schema}`);
    // Apply the test-owned schema to every connection, including concurrent transactions.
    await client.end();
    client = postgres(url, { max: 4, connection: { search_path: schema } });
    await client.unsafe(`
      CREATE TABLE users (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, email text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, deleted_at timestamptz);
      CREATE TABLE settings (user_id uuid, tenant_id uuid, settings jsonb);
      CREATE TABLE groups (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, name jsonb NOT NULL, base_language text NOT NULL, available_locales text[] NOT NULL);
      CREATE TABLE group_users (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), user_id uuid REFERENCES users(id), group_id uuid REFERENCES groups(id), tenant_id uuid NOT NULL, UNIQUE(user_id, group_id));
      CREATE TABLE outbox_events (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), event_type text NOT NULL, payload jsonb NOT NULL, status text NOT NULL, attempt_count integer NOT NULL, published_at timestamptz, last_error text, tenant_id uuid DEFAULT '${tenantId}' NOT NULL);
    `);
    await client`INSERT INTO users VALUES (${userId}, ${tenantId}, 'alex@example.com', 'Alex', 'Morgan', null)`;
    await client`INSERT INTO settings VALUES (${userId}, ${tenantId}, ${client.json({ language: "pl" })})`;
    await client`INSERT INTO groups VALUES (${groupId}, ${tenantId}, ${client.json({ en: "New staff", pl: "Nowi pracownicy" })}, 'en', ARRAY['en','pl']), (${foreignGroupId}, ${otherTenantId}, ${client.json({ en: "Foreign group" })}, 'en', ARRAY['en'])`;
    const db = drizzle(client) as unknown as DatabasePg;
    outboxRepository = new OutboxRepository(db);
    const outboxPublisher = new OutboxPublisher(
      outboxRepository,
      {} as EventBus,
      {} as OutboxDirectHandlerService,
      new OutboxNotificationPreparationService(),
    );
    jest.spyOn(outboxPublisher, "publish").mockResolvedValue(); // unrelated audit/enrollment event handlers
    service = new GroupService(
      db,
      {} as CourseService,
      outboxPublisher,
      {
        getUserAccess: async () => ({ permissions: [PERMISSIONS.USER_MANAGE] }),
      } as unknown as PermissionsService,
      new LocalizationService(db),
    );
  });

  afterAll(async () => {
    if (!client) return;
    const [{ current_schema: schema }] = await client`SELECT current_schema()`;
    if (schema.startsWith("group_assignment_"))
      await client.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  });
  beforeEach(async () => {
    await client`TRUNCATE group_users, outbox_events`;
  });

  it("persists one personalized occurrence for concurrent and repeated assignments", async () => {
    await Promise.all([
      service.setUserGroups([groupId, groupId], userId),
      service.setUserGroups([groupId], userId),
    ]);
    await service.setUserGroups([groupId], userId);
    const memberships = await client`SELECT * FROM group_users`;
    const events = await client`SELECT * FROM outbox_events`;
    expect(memberships).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tenant_id: tenantId,
      event_type: "NotificationEvent",
      status: "pending",
      payload: {
        kind: "user_assigned_to_group",
        recipients: [
          {
            email: "alex@example.com",
            language: "pl",
            eventFields: {
              group_id: groupId,
              group_name: "Nowi pracownicy",
              userFirstName: "Alex",
            },
          },
        ],
      },
    });
  });

  it("rolls membership and outbox back together when publication fails", async () => {
    const failure = jest
      .spyOn(outboxRepository, "notifyPending")
      .mockRejectedValueOnce(new Error("notify failed"));
    await expect(service.setUserGroups([groupId], userId)).rejects.toThrow("notify failed");
    failure.mockRestore();
    expect(await client`SELECT * FROM group_users`).toHaveLength(0);
    expect(await client`SELECT * FROM outbox_events`).toHaveLength(0);
  });

  it("rejects a foreign-tenant group even without database row filtering", async () => {
    await expect(service.setUserGroups([foreignGroupId], userId)).rejects.toThrow();
    expect(await client`SELECT * FROM group_users`).toHaveLength(0);
    expect(await client`SELECT * FROM outbox_events`).toHaveLength(0);
  });

  it("publishes bulk additions, skips removals, and welcomes a later re-assignment", async () => {
    const options = {
      actor: {
        userId,
        tenantId,
        email: "admin@example.com",
        roleSlugs: [],
        permissions: [],
      } as CurrentUserType,
      source: "bulk-edit" as const,
    };
    await service.changeUsersGroups([{ userId, groupIds: [groupId] }], options);
    await service.changeUsersGroups([{ userId, groupIds: [groupId] }], options);
    await service.setUserGroups([], userId);
    expect(await client`SELECT * FROM outbox_events`).toHaveLength(1);
    await service.setUserGroups([groupId], userId);
    const events = await client`SELECT * FROM outbox_events`;
    expect(events).toHaveLength(2);
    expect(events[0].payload.occurrenceId).not.toBe(events[1].payload.occurrenceId);
  });
});
