import { BadRequestException } from "@nestjs/common";

import type { AutomationStepBulkUpdate } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

export const validateAutomationStepTree = (
  automationId: UUIDType,
  steps: AutomationStepBulkUpdate[],
) => {
  if (steps.length === 0) {
    throw new BadRequestException("automationSteps.toast.emptyTree");
  }

  const ids = new Set<string>();
  let roots = 0;

  for (const step of steps) {
    if (ids.has(step.id)) {
      throw new BadRequestException("automationSteps.toast.duplicateStepId");
    }
    ids.add(step.id);

    if (step.automationId !== automationId) {
      throw new BadRequestException("automationSteps.toast.automationIdMismatch");
    }

    if (step.parentId === null) roots++;
    if (step.parentId === step.id) {
      throw new BadRequestException("automationSteps.toast.cycleDetected");
    }
  }

  if (roots !== 1) {
    throw new BadRequestException("automationSteps.toast.wrongNumberOfRoots");
  }

  for (const step of steps) {
    if (step.parentId !== null && !ids.has(step.parentId)) {
      throw new BadRequestException("automationSteps.toast.missingParent");
    }
  }

  const children = new Map<string, string[]>();
  for (const step of steps) {
    if (step.parentId === null) continue;
    const current = children.get(step.parentId) ?? [];
    current.push(step.id);
    children.set(step.parentId, current);
  }

  const root = steps.find((step) => step.parentId === null);
  if (!root) throw new BadRequestException("automationSteps.toast.stepTreeBuildFailed");

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      throw new BadRequestException("automationSteps.toast.cycleDetected");
    }
    if (visited.has(id)) return;

    visiting.add(id);
    for (const childId of children.get(id) ?? []) visit(childId);
    visiting.delete(id);
    visited.add(id);
  };

  visit(root.id);
  if (visited.size !== steps.length) {
    throw new BadRequestException("automationSteps.toast.treeNotConnected");
  }
};
