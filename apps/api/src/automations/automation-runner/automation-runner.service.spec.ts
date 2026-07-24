import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";
import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

import { AutomationRunnerService } from "./automation-runner.service";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationRunnerService", () => {
  let service: AutomationRunnerService;

  const automationStepsServiceMock = {};

  const automationLogsRepositoryMock = {
    create: jest.fn(),
    GetByAutomationId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationRunnerService,
        {
          provide: AutomationStepsService,
          useValue: automationStepsServiceMock,
        },
        {
          provide: AutomationLogsRepository,
          useValue: automationLogsRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<AutomationRunnerService>(AutomationRunnerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
