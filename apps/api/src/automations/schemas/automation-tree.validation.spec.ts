import { BadRequestException } from "@nestjs/common";

import { validateAutomationStepTree } from "./automation-tree.validation";

import type { AutomationStepBulkUpdate } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

describe("validateAutomationStepTree", () => {
  const automationId = "automation-1" as UUIDType;
  const step = (id: string, parentId: string | null, owner = automationId) =>
    ({
      id: id as UUIDType,
      parentId: parentId as UUIDType | null,
      automationId: owner,
      type: id === "root" ? "trigger" : "action",
      typeContext: { name: id === "root" ? "user_invited" : "send_email", providedVariables: [] },
    }) as AutomationStepBulkUpdate;

  it("accepts one connected root and its children", () => {
    expect(() =>
      validateAutomationStepTree(automationId, [step("root", null), step("action", "root")]),
    ).not.toThrow();
  });

  it.each([
    ["emptyTree", []],
    ["duplicateStepId", [step("root", null), step("root", null)]],
    ["automationIdMismatch", [step("root", null, "other-automation")]],
    ["missingParent", [step("root", null), step("action", "missing")]],
    ["cycleDetected", [step("root", null), step("action", "action")]],
  ])("rejects %s", (errorKey, steps) => {
    expect(() => validateAutomationStepTree(automationId, steps as AutomationStepBulkUpdate[])).toThrow(
      new BadRequestException(`automationSteps.toast.${errorKey}`),
    );
  });
});
