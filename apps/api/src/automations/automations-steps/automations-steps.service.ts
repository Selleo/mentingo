import { BadRequestException, Injectable } from "@nestjs/common";

import { AutomationStepsRepository } from "../repositories/automation-steps/automation-steps.repository";

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

  async ReplaceAutomationStepTree(automationId: UUIDType, input: AutomationStepBulkUpdate[]) {
    const roots = input.filter((step) => step.parentId == null);
    if (roots.length !== 1) {
      throw new BadRequestException("automationSteps.toast.wrongNumberOfRoots");
    }
    const root = this.buildStepGraph(input as AutomationStep[]);
    const hasCycle = this.hasCycle(root);
    const isConnected = this.isConnected(root, input.length);

    if (hasCycle) {
      throw new BadRequestException("automationSteps.toast.cycleDetected");
    }
    if (!isConnected) {
      throw new BadRequestException("automationSteps.toast.treeNotConnected");
    }

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

  private async deletePreviousTree(automationId: UUIDType) {
    const allSteps = await this.getAllAutomationSteps(automationId);
    if (allSteps.length > 0) {
      const rootStep = allSteps.find((step) => step.parentId == null);
      if (!rootStep) {
        throw new BadRequestException("automationSteps.toast.updateFailed");
      }
      const deletedId = await this.deleteAutomationStep(rootStep.id);
      if (!deletedId) {
        throw new BadRequestException("automationSteps.toast.deleteFailed");
      }
    }
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
      await this.getAutomationStepById(input.parentId);
    }
  }

  private async validateTree(input: AutomationStepRecordInput) {
    const fetchedSteps = (await this.getAllAutomationSteps(input.automationId)) as AutomationStep[];

    if (fetchedSteps.length === 0) {
      return;
    }

    const stepToInsert: AutomationStep = {
      id: "-1",
      automationId: input.automationId,
      parentId: input.parentId,
      type: input.type,
      typeContext: input.typeContext,
    };

    fetchedSteps.push(stepToInsert);

    const root = this.buildStepGraph(fetchedSteps);

    if (this.hasCycle(root)) {
      throw new BadRequestException("automationSteps.toast.cycleDetected");
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

  private hasCycle(root: StepNode) {
    const visited = new Set<UUIDType>();
    const visiting = new Set<UUIDType>();

    function dfs(node: StepNode): boolean {
      const id = node.value.id;

      if (visiting.has(id)) {
        return true;
      }

      if (visited.has(id)) {
        return false;
      }

      visiting.add(id);

      for (const child of node.children) {
        if (dfs(child)) {
          return true;
        }
      }

      visiting.delete(id);
      visited.add(id);

      return false;
    }

    return dfs(root);
  }

  private isConnected(root: StepNode, numberOfSteps: number) {
    const visited = new Set<UUIDType>();

    const dfs = (node: StepNode) => {
      if (visited.has(node.value.id)) {
        return;
      }

      visited.add(node.value.id);
      for (const child of node.children) {
        dfs(child);
      }
    };
    dfs(root);

    return visited.size === numberOfSteps;
  }
}
