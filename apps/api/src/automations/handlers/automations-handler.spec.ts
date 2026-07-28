import { Test } from "@nestjs/testing";

import { AutomationEventNames } from "src/announcements/types/automations.types";
import { UserInviteEvent, UserWelcomeEvent } from "src/events";

import { AutomationRunnerService } from "../automation-runner/automation-runner.service";
import { AutomationStepsRepository } from "../repositories/automation-steps/automation-steps.repository";

import { AutomationsHandler } from "./automations-handler";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationsHandler", () => {
  let handler: AutomationsHandler;
  let stepsRepository: jest.Mocked<AutomationStepsRepository>;
  let runnerService: jest.Mocked<AutomationRunnerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsHandler,
        {
          provide: AutomationStepsRepository,
          useValue: {
            findAutomationTriggerToRun: jest.fn(),
          },
        },
        {
          provide: AutomationRunnerService,
          useValue: {
            startAutomation: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get(AutomationsHandler);
    stepsRepository = module.get(AutomationStepsRepository);
    runnerService = module.get(AutomationRunnerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(handler).toBeDefined();
  });

  it("resolves event name from AutomationEventNames mapping", async () => {
    stepsRepository.findAutomationTriggerToRun.mockResolvedValue([]);

    const event = new UserInviteEvent({
      email: "test@example.com",
      userId: "user-1" as UUIDType,
      tenantId: "tenant-1" as UUIDType,
      token: "token-123",
      invitedByUserName: "Admin",
    } as any);

    await handler.handle(event);

    const expectedEventName = AutomationEventNames[UserInviteEvent.name];
    expect(stepsRepository.findAutomationTriggerToRun).toHaveBeenCalledWith(expectedEventName);
  });

  it("does nothing when no triggers are found", async () => {
    stepsRepository.findAutomationTriggerToRun.mockResolvedValue([]);

    const event = new UserWelcomeEvent({
      email: "test@example.com",
      userId: "user-1" as UUIDType,
      tenantId: "tenant-1" as UUIDType,
      origin: "https://app.mentingo.com",
    } as any);

    await handler.handle(event);

    expect(runnerService.startAutomation).not.toHaveBeenCalled();
  });

  it("starts automation for each unique automation id found", async () => {
    const triggers = [
      { automationId: "auto-1" as UUIDType },
      { automationId: "auto-2" as UUIDType },
    ];
    stepsRepository.findAutomationTriggerToRun.mockResolvedValue(triggers as any);

    const event = new UserInviteEvent({
      email: "test@example.com",
      userId: "user-1" as UUIDType,
      tenantId: "tenant-1" as UUIDType,
      token: "token-123",
      invitedByUserName: "Admin",
    } as any);

    await handler.handle(event);

    expect(runnerService.startAutomation).toHaveBeenCalledTimes(2);
    expect(runnerService.startAutomation).toHaveBeenCalledWith("auto-1", event);
    expect(runnerService.startAutomation).toHaveBeenCalledWith("auto-2", event);
  });

  it("deduplicates automation ids when multiple triggers belong to same automation", async () => {
    const triggers = [
      { automationId: "auto-1" as UUIDType },
      { automationId: "auto-1" as UUIDType },
      { automationId: "auto-2" as UUIDType },
    ];
    stepsRepository.findAutomationTriggerToRun.mockResolvedValue(triggers as any);

    const event = new UserInviteEvent({
      email: "test@example.com",
      userId: "user-1" as UUIDType,
      tenantId: "tenant-1" as UUIDType,
      token: "token-123",
      invitedByUserName: "Admin",
    } as any);

    await handler.handle(event);

    expect(runnerService.startAutomation).toHaveBeenCalledTimes(2);
  });
});
