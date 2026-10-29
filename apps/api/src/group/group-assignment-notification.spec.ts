import { PERMISSIONS } from "@repo/shared";

import { GroupService } from "./group.service";

import type { DatabasePg } from "src/common";
import type { CourseService } from "src/courses/course.service";
import type { LocalizationService } from "src/localization/localization.service";
import type { OutboxPublisher } from "src/outbox/outbox.publisher";
import type { PermissionsService } from "src/permissions/permissions.service";

const userId = "00000000-0000-4000-8000-000000000001";
const groupId = "00000000-0000-4000-8000-000000000002";
const tenantId = "00000000-0000-4000-8000-000000000003";

function setup(inserted = [{ groupId }]) {
  const selections = [
    [
      {
        tenantId,
        groupId: null,
        id: userId,
        email: "alex@example.com",
        firstName: "Alex",
        lastName: "Morgan",
        language: "pl",
      },
    ],
    [{ id: groupId, name: "Nowi pracownicy" }],
  ];
  const trx: Record<string, jest.Mock> = {
    select: jest.fn(() => {
      const result = selections.shift();
      const query: Record<string, jest.Mock> = {
        from: jest.fn(() => query),
        leftJoin: jest.fn(() => query),
        where: jest.fn(async () => result),
      };
      return query;
    }),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        onConflictDoNothing: jest.fn(() => ({ returning: jest.fn(async () => inserted) })),
      })),
    })),
    transaction: jest.fn(async (work) => work(trx)),
  };
  const outboxPublisher = { publish: jest.fn(), publishDurable: jest.fn() };
  const service = new GroupService(
    trx as unknown as DatabasePg,
    {} as CourseService,
    outboxPublisher as unknown as OutboxPublisher,
    {
      getUserAccess: jest.fn(async () => ({ permissions: [PERMISSIONS.USER_MANAGE] })),
    } as unknown as PermissionsService,
    { getLocalizedSqlField: jest.fn(() => "Nowi pracownicy") } as unknown as LocalizationService,
  );
  return { service, outboxPublisher, trx };
}

describe("Durable group assignment notifications", () => {
  it("snapshots the newly assigned user and localized group in the membership transaction without an actor", async () => {
    const { service, outboxPublisher, trx } = setup();
    await service.setUserGroups([groupId, groupId], userId);
    expect(outboxPublisher.publishDurable).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "user_assigned_to_group",
        recipients: [
          expect.objectContaining({
            itemId: userId,
            email: "alex@example.com",
            language: "pl",
            eventFields: expect.objectContaining({
              group_id: groupId,
              group_name: "Nowi pracownicy",
              userFirstName: "Alex",
              userLastName: "Morgan",
              userEmail: "alex@example.com",
            }),
          }),
        ],
      }),
      trx,
    );
    expect(outboxPublisher.publishDurable).toHaveBeenCalledTimes(1);
  });
});
