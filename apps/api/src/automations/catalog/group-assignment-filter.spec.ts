import { evaluateAutomationWorkflow, getAutomationWorkflowIssues } from "@repo/shared";

const groupId = "00000000-0000-4000-8000-000000000002";
const workflow = (selectedGroupId?: string) => ({
  rootStepId: "00000000-0000-4000-8000-000000000004",
  steps: [
    {
      id: "00000000-0000-4000-8000-000000000004",
      parentId: null,
      position: 0,
      type: "trigger" as const,
      config: { eventKind: "user_assigned_to_group" as const, groupId: selectedGroupId },
    },
  ],
});

describe("Group-filtered automation workflows", () => {
  it("skips assignments to another group and requires a selected group before applying", () => {
    expect(evaluateAutomationWorkflow(workflow(groupId), { group_id: "other-group" }).path).toEqual(
      [],
    );
    expect(evaluateAutomationWorkflow(workflow(groupId), { group_id: groupId }).path).toHaveLength(
      1,
    );
    expect(evaluateAutomationWorkflow(workflow(), { group_id: groupId }).path).toEqual([]);
    expect(getAutomationWorkflowIssues(workflow(), { requireComplete: true })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing_group" })]),
    );
  });
});
