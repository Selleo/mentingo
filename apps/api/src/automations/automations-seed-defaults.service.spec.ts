import { Test } from "@nestjs/testing";

import { AutomationStatus } from "src/announcements/types/automations.types";

import { AutomationsSeedDefaultsService } from "./automations-seed-defaults.service";
import { AutomationStepsService } from "./automations-steps/automations-steps.service";
import { AutomationsService } from "./automations.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationsSeedDefaultsService", () => {
  let service: AutomationsSeedDefaultsService;
  let automationsService: jest.Mocked<AutomationsService>;
  let automationStepsService: jest.Mocked<AutomationStepsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsSeedDefaultsService,
        {
          provide: AutomationsService,
          useValue: {
            createAutomation: jest.fn(),
            deleteAutomation: jest.fn(),
          },
        },
        {
          provide: AutomationStepsService,
          useValue: {
            getTriggerNamesByTenantId: jest.fn(),
            createAutomationStep: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AutomationsSeedDefaultsService);
    automationsService = module.get(AutomationsService);
    automationStepsService = module.get(AutomationStepsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("seedDefaults", () => {
    const tenantId = "tenant-1" as UUIDType;

    it("creates all default automations when none exist", async () => {
      automationStepsService.getTriggerNamesByTenantId.mockResolvedValue([]);
      automationsService.createAutomation.mockResolvedValue({
        id: "new-automation-id" as UUIDType,
        name: {},
        description: {},
        status: "enabled",
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRun: null,
      } as any);
      automationStepsService.createAutomationStep.mockResolvedValue(
        "step-id" as unknown as UUIDType,
      );

      const result = await service.seedDefaults(tenantId, "en");

      expect(result.created).toBe(18);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(18);
      // Each automation creates 2 steps (trigger + action)
      expect(automationStepsService.createAutomationStep).toHaveBeenCalledTimes(36);
    });

    it("skips automations that already have matching triggers", async () => {
      automationStepsService.getTriggerNamesByTenantId.mockResolvedValue(["user_invited"]);
      automationsService.createAutomation.mockResolvedValue({
        id: "new-id" as UUIDType,
        name: {},
        description: {},
        status: "enabled",
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRun: null,
      } as any);
      automationStepsService.createAutomationStep.mockResolvedValue(
        "step-id" as unknown as UUIDType,
      );

      const result = await service.seedDefaults(tenantId, "en");

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(17);
      expect(result.total).toBe(18);
    });

    it("skips all when all triggers already exist", async () => {
      const allTriggerTypes = [
        "user_invited",
        "users_imported_invite",
        "user_password_reminder",
        "user_welcome",
        "user_first_login",
        "users_assigned_to_course",
        "users_short_inactivity",
        "users_long_inactivity",
        "user_chapter_finished",
        "user_course_finished",
        "user_registered",
        "user_password_created",
        "course_completed",
        "certificate_expiration_warning",
        "certificate_archived",
        "announcement_published",
        "course_chat_user_mentioned",
        "course_due_date_reminder",
      ];

      automationStepsService.getTriggerNamesByTenantId.mockResolvedValue(allTriggerTypes);

      const result = await service.seedDefaults(tenantId, "en");

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(18);
      expect(result.total).toBe(18);
      expect(automationsService.createAutomation).not.toHaveBeenCalled();
    });

    it("creates automation with enabled status and properly structured steps", async () => {
      automationStepsService.getTriggerNamesByTenantId.mockResolvedValue([]);
      automationsService.createAutomation.mockResolvedValue({
        id: "created-id" as UUIDType,
        name: { pl: "test", en: "test" },
        description: {},
        status: "enabled",
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRun: null,
      } as any);
      automationStepsService.createAutomationStep.mockResolvedValue(
        "trigger-step-id" as unknown as UUIDType,
      );

      await service.seedDefaults(tenantId, "en");

      expect(automationsService.createAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ status: AutomationStatus.Enabled }),
      );

      expect(automationStepsService.createAutomationStep).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: null,
          type: "trigger",
          typeContext: expect.objectContaining({
            name: expect.any(String),
            label: "User Invitation",
            config: {},
            position: { x: 0, y: 0 },
          }),
        }),
      );

      expect(automationStepsService.createAutomationStep).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "trigger-step-id",
          type: "action",
          typeContext: expect.objectContaining({
            name: "send_email",
            label: "Send email", // EN label
            config: expect.objectContaining({
              emailTemplate: expect.any(String),
              language: "user_default",
              placeholderValues: expect.any(Object),
            }),
            position: { x: 0, y: 150 },
          }),
        }),
      );
    });

    it("maps placeholderValues correctly for user_invited trigger", async () => {
      automationStepsService.getTriggerNamesByTenantId.mockResolvedValue([]);
      automationsService.createAutomation.mockResolvedValue({
        id: "created-id" as UUIDType,
        name: {},
        description: {},
        status: "enabled",
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRun: null,
      } as any);
      automationStepsService.createAutomationStep.mockResolvedValue(
        "trigger-step-id" as unknown as UUIDType,
      );

      await service.seedDefaults(tenantId, "en");

      const actionCalls = automationStepsService.createAutomationStep.mock.calls.filter(
        ([input]) => input.type === "action",
      );

      const firstAction = actionCalls[0][0];
      expect((firstAction.typeContext as Record<string, unknown>).config).toEqual({
        emailTemplate: "user_invite",
        language: "user_default",
        placeholderValues: {
          invitedByUserName: "invitedByUserName",
          createPasswordLink: "inviteLink",
        },
      });
    });

    it("reports failed creation separately and removes the partial automation", async () => {
      automationStepsService.getTriggerNamesByTenantId.mockResolvedValue([]);
      automationsService.createAutomation.mockResolvedValue({
        id: "created-id" as UUIDType,
        name: {},
        description: {},
        status: "enabled",
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRun: null,
      } as any);
      automationStepsService.createAutomationStep
        .mockResolvedValueOnce("trigger-step-id" as unknown as UUIDType)
        .mockRejectedValueOnce(new Error("step insert failed"))
        .mockResolvedValue("step-id" as unknown as UUIDType);

      const result = await service.seedDefaults(tenantId, "en");

      expect(result.failed).toBe(1);
      expect(result.created).toBe(17);
      expect(result.skipped).toBe(0);
      expect(automationsService.deleteAutomation).toHaveBeenCalledWith("created-id");
    });
  });
});
