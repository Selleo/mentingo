import { evaluateAutomationWorkflow, getAutomationWorkflowIssues } from "@repo/shared";

const triggerId = "00000000-0000-4000-8000-000000000004";
const conditionId = "00000000-0000-4000-8000-000000000005";
const groupId = "00000000-0000-4000-8000-000000000002";
const workflow = (selectedGroupId?: string) => ({
  rootStepId: triggerId,
  steps: [
    {
      id: triggerId,
      parentId: null,
      position: 0,
      type: "trigger" as const,
      config: { eventKind: "user_assigned_to_group" as const },
    },
    {
      id: conditionId,
      parentId: triggerId,
      position: 0,
      type: "condition" as const,
      config: { field: "group_id", equals: selectedGroupId },
    },
  ],
});

describe("Group condition in automation workflows", () => {
  it("follows Yes for the selected group, No for another group, and requires a selected group", () => {
    expect(
      evaluateAutomationWorkflow(workflow(groupId), { group_id: groupId }).steps,
    ).toContainEqual(expect.objectContaining({ stepId: conditionId, trueCount: 1, falseCount: 0 }));
    expect(
      evaluateAutomationWorkflow(workflow(groupId), { group_id: "other-group" }).steps,
    ).toContainEqual(expect.objectContaining({ stepId: conditionId, trueCount: 0, falseCount: 1 }));
    expect(getAutomationWorkflowIssues(workflow(), { requireComplete: true })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_group" })]),
    );
  });
});
