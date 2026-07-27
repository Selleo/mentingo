import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import { AutomationDataResolverService } from "./automation-data-resolver.service";
import { AutomationRunnerService } from "./automation-runner.service";
import { AutomationTemplateService } from "./automation-template.service";

import type { AutomationResolvedRecipient } from "./automation-data-resolver.types";
import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationRunnerService", () => {
  let service: AutomationRunnerService;
  let stepsService: jest.Mocked<AutomationStepsService>;
  let dataResolver: jest.Mocked<AutomationDataResolverService>;

  const automationId = "auto-1" as UUIDType;

  const mockRecipients: AutomationResolvedRecipient[] = [
    {
      userEmail: "jan@example.com",
      tenantId: "tenant-1" as UUIDType,
      variables: {
        userFirstName: "Jan",
        userLastName: "Kowalski",
        userEmail: "jan@example.com",
      },
    },
  ];

  const makeStep = (overrides: Record<string, unknown>) => ({
    id: "step-id",
    parentId: null,
    automationId,
    type: "trigger",
    typeContext: { name: "user_invited", providedVariables: [] },
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    tenantId: "tenant-1",
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationRunnerService,
        {
          provide: AutomationStepsService,
          useValue: {
            getAllAutomationSteps: jest.fn(),
          },
        },
        {
          provide: AutomationDataResolverService,
          useValue: {
            resolve: jest.fn(),
          },
        },
        {
          provide: AutomationTemplateService,
          useValue: {
            getTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AutomationRunnerService);
    stepsService = module.get(AutomationStepsService);
    dataResolver = module.get(AutomationDataResolverService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("startAutomation", () => {
    it("does nothing when no recipients are resolved", async () => {
      stepsService.getAllAutomationSteps.mockResolvedValue([]);
      dataResolver.resolve.mockResolvedValue([]);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      await service.startAutomation(automationId, mockEvent);

      expect(stepsService.getAllAutomationSteps).toHaveBeenCalledWith(automationId);
      expect(dataResolver.resolve).toHaveBeenCalledWith(mockEvent);
    });

    it("executes steps when recipients are resolved", async () => {
      const steps = [
        makeStep({ id: "trigger-1", type: "trigger" }),
        makeStep({
          id: "action-1",
          parentId: "trigger-1",
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        }),
      ];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps as any);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      await expect(service.startAutomation(automationId, mockEvent)).resolves.not.toThrow();
    });

    it("throws when step tree has no root", async () => {
      const steps = [
        makeStep({
          id: "child",
          parentId: "nonexistent",
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        }),
      ];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps as any);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      await expect(service.startAutomation(automationId, mockEvent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws for unknown step type", async () => {
      const steps = [makeStep({ id: "root", type: "unknown_type" })];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps as any);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      await expect(service.startAutomation(automationId, mockEvent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("executes child actions after parent trigger", async () => {
      const steps = [
        makeStep({ id: "trigger", type: "trigger" }),
        makeStep({
          id: "action-a",
          parentId: "trigger",
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        }),
        makeStep({
          id: "action-b",
          parentId: "trigger",
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        }),
      ];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps as any);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      await expect(service.startAutomation(automationId, mockEvent)).resolves.not.toThrow();
    });
  });
});
