import { BadRequestException, Injectable } from "@nestjs/common";

import { AutomationStepsRepository } from "../repositories/automation-steps/automation-steps.repository";
import { validateAutomationStepTree } from "../schemas/automation-tree.validation";

import type {
  AutomationStep,
  AutomationStepBulkUpdate,
  AutomationStepRecordInput,
} from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

type StepNode = {
  children: StepNode[];
  value: AutomationStep;
};

@Injectable()
export class AutomationStepsService {
  constructor(private readonly automationStepsRepository: AutomationStepsRepository) {}

  async createAutomationStep(input: AutomationStepRecordInput) {
    await this.validateStep(input);
    return this.automationStepsRepository.createAutomationStep(input);
  }

  async getAllAutomationSteps(automationId: UUIDType) {
    return this.automationStepsRepository.getAllAutomationStepsByAutomationId(automationId);
  }

  async getTriggerNamesByTenantId(tenantId: UUIDType) {
    return this.automationStepsRepository.getTriggerNamesByTenantId(tenantId);
  }

  async getAutomationStepById(stepId: UUIDType) {
    const step = await this.automationStepsRepository.getAutomationStepById(stepId);

    if (!step) {
      throw new BadRequestException("automationSteps.toast.notFound");
    }

    return step;
  }

  async updateAutomationStep(stepId: UUIDType, input: AutomationStepRecordInput) {
    const stepToUpdate = await this.getAutomationStepById(stepId);

    const isIdMismatch =
      stepToUpdate.parentId !== input.parentId || stepToUpdate.automationId !== input.automationId;

    if (isIdMismatch) {
      throw new BadRequestException("automationSteps.toast.idMismatch");
    }

    await this.validateStep(input);

    const updatedId = await this.automationStepsRepository.updateAutomationStep(stepId, input);

    if (!updatedId) {
      throw new BadRequestException("automationSteps.toast.updateFailed");
    }

    return updatedId;
  }

  async replaceAutomationStepTree(automationId: UUIDType, input: AutomationStepBulkUpdate[]) {
    validateAutomationStepTree(automationId, input);

    const res = await this.automationStepsRepository.replaceAutomationStepTree(automationId, input);
    if (!res) {
      throw new BadRequestException("automationSteps.toast.bulkInsertFailed");
    }
  }

  async deleteAutomationStep(stepId: UUIDType) {
    const childrenIdsToDelete = await this.getIdsToDeleteCascade(stepId);
    const idsToDelete = [...childrenIdsToDelete, stepId];

    for (const id of idsToDelete) {
      const deletedId = await this.automationStepsRepository.deleteAutomationStep(id);

      if (!deletedId) {
        throw new BadRequestException("automationSteps.toast.deleteFailed");
      }
    }

    return stepId;
  }

  private async getIdsToDeleteCascade(stepId: UUIDType) {
    const stepToDelete = await this.getAutomationStepById(stepId);
    const allSteps = await this.getAllAutomationSteps(stepToDelete.automationId);

    const root = this.buildStepGraph(allSteps);
    const nodeToDelete = this.findNode(root, stepId);

    return this.getChildrenIds(nodeToDelete);
  }

  private getChildrenIds(root: StepNode) {
    const childrenIds: UUIDType[] = [];
    const toVisit: StepNode[] = [root];

    while (toVisit.length > 0) {
      const curr = toVisit.pop();

      if (!curr) {
        continue;
      }

      for (const child of curr.children) {
        childrenIds.push(child.value.id);
        toVisit.push(child);
      }
    }

    return childrenIds;
  }

  private findNode(root: StepNode, id: UUIDType) {
    const stack: StepNode[] = [root];

    while (stack.length > 0) {
      const current = stack.pop();

      if (!current) {
        continue;
      }

      if (current.value.id === id) {
        return current;
      }

      stack.push(...current.children);
    }

    throw new BadRequestException("automationSteps.toast.nodeDeleteFailed");
  }

  private async hasNoSteps(automationId: UUIDType) {
    const allSteps = await this.getAllAutomationSteps(automationId);
    return allSteps.length === 0;
  }

  private async validateStep(input: AutomationStepRecordInput) {
    const hasNoSteps = await this.hasNoSteps(input.automationId);

    if (hasNoSteps && input.parentId != null) {
      throw new BadRequestException("automationSteps.toast.noRootStep");
    }

    if (!hasNoSteps && input.parentId == null) {
      throw new BadRequestException("automationSteps.toast.hasRootAlready");
    }

    if (input.parentId) {
      const parent = await this.getAutomationStepById(input.parentId);
      if (parent.automationId !== input.automationId) {
        throw new BadRequestException("automationSteps.toast.automationIdMismatch");
      }
    }
  }

  private buildStepGraph(steps: AutomationStep[]) {
    const nodes = new Map<UUIDType, StepNode>();

    for (const step of steps) {
      nodes.set(step.id, {
        value: step,
        children: [],
      });
    }

    let root: StepNode | null = null;

    for (const step of steps) {
      const node = nodes.get(step.id)!;

      if (step.parentId === null) {
        root = node;
        continue;
      }

      const parent = nodes.get(step.parentId);

      if (parent) {
        parent.children.push(node);
      }
    }

    if (!root) {
      throw new BadRequestException("automationSteps.toast.stepTreeBuildFailed");
    }

    return root;
  }

}
