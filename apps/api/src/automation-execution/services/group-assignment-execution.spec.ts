import { createUserNotificationEvent } from "../utils/create-user-notification-event";

import { AutomationRecipientResolverService } from "./automation-recipient-resolver.service";
import { AutomationRunCreationService } from "./automation-run-creation.service";

import type { AutomationRecipientRepository } from "../repositories/automation-recipient.repository";
import type { AutomationRecord } from "src/automations/automation.types";
import type { DatabasePg } from "src/common";

it("queues a personalized welcome only for the new member of the configured group", async () => {
  const groupId = "00000000-0000-4000-8000-000000000002";
  const automation = (id: string, selectedGroupId: string) =>
    ({
      id,
      appliedDefinition: {
        name: id,
        workflow: {
          rootStepId: "00000000-0000-4000-8000-000000000010",
          steps: [
            {
              id: "00000000-0000-4000-8000-000000000010",
              parentId: null,
              position: 0,
              type: "trigger",
              config: { eventKind: "user_assigned_to_group", groupId: selectedGroupId },
            },
            {
              id: "00000000-0000-4000-8000-000000000011",
              parentId: "00000000-0000-4000-8000-000000000010",
              position: 0,
              type: "send_email",
              config: { template: { type: "builtin", key: "welcome" }, mappings: {} },
            },
          ],
        },
      },
      executionVersion: 1,
    }) as AutomationRecord;
  const insertRun = jest.fn(async () => ({ id: "run" }));
  const insertDelivery = jest.fn(async () => ({ id: "delivery" }));
  const publish = jest.fn();
  const listRecipients = jest.fn();
  const resolver = new AutomationRecipientResolverService({
    listAutomationRecipients: listRecipients,
  } as unknown as AutomationRecipientRepository);
  const service = new AutomationRunCreationService(
    ...([
      {
        listEnabledAutomations: async () => [
          automation("matching", groupId),
          automation("other", "other-group"),
        ],
      },
      {
        insertNotificationOccurrenceIfNew: async () => ({}),
        insertAutomationRun: insertRun,
        insertAutomationEmailDelivery: insertDelivery,
      },
      {},
      {},
      {},
      { publish },
      {},
      { ensureTenantDefaultAutomations: async () => undefined },
      resolver,
    ] as unknown as ConstructorParameters<typeof AutomationRunCreationService>),
  );
  const event = createUserNotificationEvent({
    kind: "user_assigned_to_group",
    user: { id: "learner", firstName: "Alex", lastName: "Morgan", email: "alex@example.com" },
    language: "pl",
    eventFields: { group_id: groupId, group_name: "Nowi pracownicy" },
  });
  await service.createAutomationRunsForNotificationEvent(event, {
    execute: async () => [],
  } as unknown as DatabasePg);
  expect(insertRun).toHaveBeenCalledTimes(1);
  expect(insertRun).toHaveBeenCalledWith(
    expect.objectContaining({ automationId: "matching" }),
    expect.anything(),
  );
  expect(insertDelivery).toHaveBeenCalledTimes(1);
  expect(insertDelivery).toHaveBeenCalledWith(
    expect.objectContaining({
      recipientEmail: "alex@example.com",
      recipientItemId: "learner",
      language: "pl",
      eventFields: expect.objectContaining({
        group_id: groupId,
        group_name: "Nowi pracownicy",
        userFirstName: "Alex",
        userLastName: "Morgan",
        userEmail: "alex@example.com",
      }),
    }),
    expect.anything(),
  );
  expect(listRecipients).not.toHaveBeenCalled();
  expect(publish).toHaveBeenCalledWith(
    expect.objectContaining({ emailDeliveryId: "delivery" }),
    expect.anything(),
  );
});
