import { Test } from "@nestjs/testing";

import { BaseResponse } from "src/common";

import { AutomationStepsController } from "./automations-steps.controller";
import { AutomationStepsService } from "./automations-steps.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationStepsController", () => {
  let controller: AutomationStepsController;
  let service: jest.Mocked<AutomationStepsService>;

  const automationId = "auto-1" as UUIDType;
  const stepId = "step-1" as UUIDType;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationStepsController],
      providers: [
        {
          provide: AutomationStepsService,
          useValue: {
            createAutomationStep: jest.fn(),
            getAutomationStepById: jest.fn(),
            getAllAutomationSteps: jest.fn(),
            updateAutomationStep: jest.fn(),
            deleteAutomationStep: jest.fn(),
            ReplaceAutomationStepTree: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AutomationStepsController);
    service = module.get(AutomationStepsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("creates step and returns BaseResponse with id", async () => {
      service.createAutomationStep.mockResolvedValue(stepId);

      const input = {
        parentId: null,
        automationId,
        type: "trigger" as const,
        typeContext: { name: "user_invited", providedVariables: [] },
      };

      const result = await controller.create(input);

      expect(service.createAutomationStep).toHaveBeenCalledWith(input);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ id: stepId });
    });
  });

  describe("getById", () => {
    it("returns step wrapped in BaseResponse", async () => {
      const step = { id: stepId, type: "trigger", typeContext: { name: "user_invited" } };
      service.getAutomationStepById.mockResolvedValue(step as any);

      const result = await controller.getById(stepId);

      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(step);
    });
  });

  describe("getAll", () => {
    it("returns all steps for automation wrapped in BaseResponse", async () => {
      const steps = [
        { id: "s1", type: "trigger" },
        { id: "s2", type: "action" },
      ];
      service.getAllAutomationSteps.mockResolvedValue(steps as any);

      const result = await controller.getAll(automationId);

      expect(service.getAllAutomationSteps).toHaveBeenCalledWith(automationId);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("update", () => {
    it("updates step and returns BaseResponse with id", async () => {
      service.updateAutomationStep.mockResolvedValue(stepId);

      const input = {
        parentId: null,
        automationId,
        type: "trigger" as const,
        typeContext: { name: "user_welcome", providedVariables: [] },
      };

      const result = await controller.update(stepId, input);

      expect(service.updateAutomationStep).toHaveBeenCalledWith(stepId, input);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ id: stepId });
    });
  });

  describe("replaceAutomationStepTree", () => {
    it("replaces tree and returns success message", async () => {
      service.ReplaceAutomationStepTree.mockResolvedValue(undefined);

      const steps = [
        {
          id: "root" as UUIDType,
          parentId: null,
          automationId,
          type: "trigger" as const,
          typeContext: { name: "user_invited", providedVariables: [] },
        },
      ];

      const result = await controller.replaceAutomationStepTree(automationId, steps);

      expect(service.ReplaceAutomationStepTree).toHaveBeenCalledWith(automationId, steps);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ message: "Step tree replaced successfully" });
    });
  });

  describe("delete", () => {
    it("deletes step and returns BaseResponse with id", async () => {
      service.deleteAutomationStep.mockResolvedValue(stepId);

      const result = await controller.delete(stepId);

      expect(service.deleteAutomationStep).toHaveBeenCalledWith(stepId);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ id: stepId });
    });
  });
});
