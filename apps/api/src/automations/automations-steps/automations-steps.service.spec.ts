import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AutomationStepsRepository } from "../repositories/automation-steps/automation-steps.repository";

import { AutomationStepsService } from "./automations-steps.service";

import type { TestingModule } from "@nestjs/testing";
import type { AutomationStepBulkUpdate } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

describe("AutomationStepsService", () => {
  let service: AutomationStepsService;
  let repository: jest.Mocked<AutomationStepsRepository>;

  const automationId = "auto-1" as UUIDType;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationStepsService,
        {
          provide: AutomationStepsRepository,
          useValue: {
            createAutomationStep: jest.fn(),
            getAutomationStepById: jest.fn(),
            getAllAutomationStepsByAutomationId: jest.fn(),
            updateAutomationStep: jest.fn(),
            deleteAutomationStep: jest.fn(),
            replaceAutomationStepTree: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AutomationStepsService);
    repository = module.get(AutomationStepsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createAutomationStep", () => {
    it("creates a root step when automation has no steps", async () => {
      repository.getAllAutomationStepsByAutomationId.mockResolvedValue([]);
      repository.createAutomationStep.mockResolvedValue("step-1" as UUIDType);

      const input = {
        parentId: null,
        automationId,
        type: "trigger" as const,
        typeContext: { name: "user_invited", providedVariables: [] },
      };

      const result = await service.createAutomationStep(input);

      expect(result).toBe("step-1");
      expect(repository.createAutomationStep).toHaveBeenCalledWith(input);
    });

    it("rejects root step when automation already has steps", async () => {
      repository.getAllAutomationStepsByAutomationId.mockResolvedValue([
        { id: "existing-root", parentId: null } as any,
      ]);

      const input = {
        parentId: null,
        automationId,
        type: "trigger" as const,
        typeContext: { name: "user_welcome", providedVariables: [] },
      };

      await expect(service.createAutomationStep(input)).rejects.toThrow(BadRequestException);
    });

    it("rejects child step when automation has no steps (no root)", async () => {
      repository.getAllAutomationStepsByAutomationId.mockResolvedValue([]);

      const input = {
        parentId: "parent-1" as UUIDType,
        automationId,
        type: "action" as const,
        typeContext: { name: "send_email", providedVariables: [] },
      };

      await expect(service.createAutomationStep(input)).rejects.toThrow(BadRequestException);
    });

    it("creates child step when parent exists", async () => {
      const existingRoot = {
        id: "root-1",
        parentId: null,
        automationId,
        type: "trigger",
        typeContext: { name: "user_invited", providedVariables: [] },
      };

      repository.getAllAutomationStepsByAutomationId.mockResolvedValue([existingRoot] as any);
      repository.getAutomationStepById.mockResolvedValue(existingRoot as any);
      repository.createAutomationStep.mockResolvedValue("step-2" as UUIDType);

      const input = {
        parentId: "root-1" as UUIDType,
        automationId,
        type: "action" as const,
        typeContext: { name: "send_email", providedVariables: [] },
      };

      const result = await service.createAutomationStep(input);
      expect(result).toBe("step-2");
    });
  });

  describe("getAutomationStepById", () => {
    it("returns step when found", async () => {
      const step = { id: "step-1", type: "trigger" };
      repository.getAutomationStepById.mockResolvedValue(step as any);

      const result = await service.getAutomationStepById("step-1" as UUIDType);
      expect(result).toEqual(step);
    });

    it("throws BadRequestException when step not found", async () => {
      repository.getAutomationStepById.mockResolvedValue(undefined as any);

      await expect(service.getAutomationStepById("missing" as UUIDType)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateAutomationStep", () => {
    it("updates when ids match and step exists", async () => {
      const rootStep = {
        id: "root-1",
        parentId: null,
        automationId,
        type: "trigger",
      };
      const existingStep = {
        id: "step-1",
        parentId: "root-1" as UUIDType,
        automationId,
        type: "action",
      };

      repository.getAutomationStepById.mockResolvedValueOnce(existingStep as any);
      repository.getAutomationStepById.mockResolvedValueOnce(rootStep as any);
      repository.getAllAutomationStepsByAutomationId.mockResolvedValue([
        rootStep,
        existingStep,
      ] as any);
      repository.updateAutomationStep.mockResolvedValue("step-1" as UUIDType);

      const input = {
        parentId: "root-1" as UUIDType,
        automationId,
        type: "action" as const,
        typeContext: { name: "send_email", providedVariables: [] },
      };

      const result = await service.updateAutomationStep("step-1" as UUIDType, input);
      expect(result).toBe("step-1");
    });

    it("throws when parentId mismatches", async () => {
      const existingStep = {
        id: "step-1",
        parentId: "parent-A" as UUIDType,
        automationId,
      };

      repository.getAutomationStepById.mockResolvedValue(existingStep as any);

      const input = {
        parentId: "parent-B" as UUIDType,
        automationId,
        type: "action" as const,
        typeContext: { name: "send_email", providedVariables: [] },
      };

      await expect(service.updateAutomationStep("step-1" as UUIDType, input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws when automationId mismatches", async () => {
      const existingStep = {
        id: "step-1",
        parentId: null,
        automationId: "auto-A" as UUIDType,
      };

      repository.getAutomationStepById.mockResolvedValue(existingStep as any);

      const input = {
        parentId: null,
        automationId: "auto-B" as UUIDType,
        type: "trigger" as const,
        typeContext: { name: "user_invited", providedVariables: [] },
      };

      await expect(service.updateAutomationStep("step-1" as UUIDType, input)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("replaceAutomationStepTree", () => {
    it("replaces step tree for valid connected acyclic input", async () => {
      const steps: AutomationStepBulkUpdate[] = [
        {
          id: "root" as UUIDType,
          parentId: null,
          automationId,
          type: "trigger",
          typeContext: { name: "user_invited", providedVariables: [] },
        },
        {
          id: "action-1" as UUIDType,
          parentId: "root" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
      ];

      repository.replaceAutomationStepTree.mockResolvedValue(true);

      await service.replaceAutomationStepTree(automationId, steps);

      expect(repository.replaceAutomationStepTree).toHaveBeenCalledWith(automationId, steps);
    });

    it("rejects step tree with zero roots", async () => {
      const steps: AutomationStepBulkUpdate[] = [
        {
          id: "a" as UUIDType,
          parentId: "b" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
        {
          id: "b" as UUIDType,
          parentId: "a" as UUIDType,
          automationId,
          type: "trigger",
          typeContext: { name: "user_invited", providedVariables: [] },
        },
      ];

      await expect(service.replaceAutomationStepTree(automationId, steps)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects step tree with multiple roots", async () => {
      const steps: AutomationStepBulkUpdate[] = [
        {
          id: "root-1" as UUIDType,
          parentId: null,
          automationId,
          type: "trigger",
          typeContext: { name: "user_invited", providedVariables: [] },
        },
        {
          id: "root-2" as UUIDType,
          parentId: null,
          automationId,
          type: "trigger",
          typeContext: { name: "user_welcome", providedVariables: [] },
        },
      ];

      await expect(service.replaceAutomationStepTree(automationId, steps)).rejects.toThrow(
        "automationSteps.toast.wrongNumberOfRoots",
      );
    });

    it("rejects a step tree with a missing parent", async () => {
      const steps: AutomationStepBulkUpdate[] = [
        {
          id: "root" as UUIDType,
          parentId: null,
          automationId,
          type: "trigger",
          typeContext: { name: "user_invited", providedVariables: [] },
        },
        {
          id: "action-1" as UUIDType,
          parentId: "root" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
        {
          id: "action-2" as UUIDType,
          parentId: "nonexistent" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
      ];

      await expect(service.replaceAutomationStepTree(automationId, steps)).rejects.toThrow(
        "automationSteps.toast.missingParent",
      );
    });
  });

  describe("deleteAutomationStep", () => {
    it("deletes step and its children recursively", async () => {
      const steps = [
        { id: "root", parentId: null, automationId, type: "trigger", typeContext: {} },
        { id: "child-1", parentId: "root", automationId, type: "action", typeContext: {} },
        { id: "grandchild", parentId: "child-1", automationId, type: "action", typeContext: {} },
      ];

      repository.getAutomationStepById.mockResolvedValueOnce(steps[0] as any);
      repository.getAllAutomationStepsByAutomationId.mockResolvedValue(steps as any);
      repository.deleteAutomationStep.mockResolvedValue("id" as UUIDType);

      await service.deleteAutomationStep("root" as UUIDType);

      expect(repository.deleteAutomationStep).toHaveBeenCalledTimes(3);
    });
  });
});
