import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";

import { AutomationDataResolverService } from "./automation-data-resolver.service";
import { AutomationRunnerService } from "./automation-runner.service";
import { AutomationTemplateService } from "./automation-template.service";

import type { AutomationResolvedRecipient } from "./automation-data-resolver.types";
import type { TestingModule } from "@nestjs/testing";
import type { AutomationStep } from "src/announcements/types/automations-source.types";
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
    templateService = module.get(AutomationTemplateService);
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
      const steps: AutomationStep[] = [
        {
          id: "trigger-1" as UUIDType,
          parentId: null,
          automationId,
          type: "trigger",
          typeContext: { name: "user_invited", providedVariables: [] },
        },
        {
          id: "action-1" as UUIDType,
          parentId: "trigger-1" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
      ];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      // Should not throw — the runner executes the tree
      await expect(service.startAutomation(automationId, mockEvent)).resolves.not.toThrow();
    });

    it("throws when step tree has no root", async () => {
      const steps: AutomationStep[] = [
        {
          id: "child" as UUIDType,
          parentId: "nonexistent" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
      ];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      await expect(service.startAutomation(automationId, mockEvent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws for unknown step type", async () => {
      const steps: AutomationStep[] = [
        {
          id: "root" as UUIDType,
          parentId: null,
          automationId,
          type: "unknown_type" as any,
          typeContext: { name: "something", providedVariables: [] },
        },
      ];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      await expect(service.startAutomation(automationId, mockEvent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("executes child actions after parent trigger", async () => {
      const steps: AutomationStep[] = [
        {
          id: "trigger" as UUIDType,
          parentId: null,
          automationId,
          type: "trigger",
          typeContext: { name: "user_invited", providedVariables: [] },
        },
        {
          id: "action-a" as UUIDType,
          parentId: "trigger" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
        {
          id: "action-b" as UUIDType,
          parentId: "trigger" as UUIDType,
          automationId,
          type: "action",
          typeContext: { name: "send_email", providedVariables: [] },
        },
      ];

      stepsService.getAllAutomationSteps.mockResolvedValue(steps);
      dataResolver.resolve.mockResolvedValue(mockRecipients);

      const mockEvent = { constructor: { name: "UserInviteEvent" } } as any;

      // Both action children should be executed without error
      await expect(service.startAutomation(automationId, mockEvent)).resolves.not.toThrow();
    });
  });
});
