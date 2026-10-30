import { AutomationValidationAndSimulationService } from "./automation-validation-and-simulation.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

it("rejects an unavailable or foreign-tenant condition group before applying", async () => {
  const exists = jest.fn(async () => false);
  const service = new AutomationValidationAndSimulationService(
    ...([
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      { doesAutomationRecipientSelectionExist: exists },
    ] as unknown as ConstructorParameters<typeof AutomationValidationAndSimulationService>),
  );
  const id = "00000000-0000-4000-8000-000000000001";
  const conditionId = "00000000-0000-4000-8000-000000000004";
  const groupId = "00000000-0000-4000-8000-000000000002";
  const tenantId = "00000000-0000-4000-8000-000000000003";
  const issues = await service.collectAutomationReadinessIssues(
    {
      rootStepId: id,
      steps: [
        {
          id,
          parentId: null,
          position: 0,
          type: "trigger",
          config: { eventKind: "user_assigned_to_group" },
        },
        {
          id: conditionId,
          parentId: id,
          position: 0,
          type: "condition",
          config: { field: "group_id", equals: groupId },
        },
      ],
    },
    undefined,
    tenantId,
  );
  expect(exists).toHaveBeenCalledWith({ type: "group", groupId }, tenantId);
  expect(issues).toContainEqual(
    expect.objectContaining({ code: "missing_group", stepId: conditionId }),
  );
});

it("simulates the Yes branch of the configured group condition", async () => {
  const service = new AutomationValidationAndSimulationService(
    ...([{ publish: jest.fn() }, {}, {}, {}, {}, {}, {}, {}] as unknown as ConstructorParameters<
      typeof AutomationValidationAndSimulationService
    >),
  );
  jest.spyOn(service, "collectAutomationReadinessIssues").mockResolvedValue([]);
  const id = "00000000-0000-4000-8000-000000000001";
  const conditionId = "00000000-0000-4000-8000-000000000004";
  const result = await service.simulateAutomation(
    {
      workflow: {
        rootStepId: id,
        steps: [
          {
            id,
            parentId: null,
            position: 0,
            type: "trigger",
            config: { eventKind: "user_assigned_to_group" },
          },
          {
            id: conditionId,
            parentId: id,
            position: 0,
            type: "condition",
            config: { field: "group_id", equals: "00000000-0000-4000-8000-000000000002" },
          },
        ],
      },
    },
    { tenantId: "tenant" } as CurrentUserType,
  );
  expect(result.steps).toContainEqual(
    expect.objectContaining({ stepId: conditionId, trueCount: 1, falseCount: 0 }),
  );
});
