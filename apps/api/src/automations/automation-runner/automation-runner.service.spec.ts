import { Test } from "@nestjs/testing";

import { AutomationStepsService } from "../automations-steps/automations-steps.service";
import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

import { AutomationDataResolverService } from "./automation-data-resolver.service";
import { AutomationRunnerService } from "./automation-runner.service";
import { AutomationTemplateService } from "./automation-template.service";

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
        {
          provide: AutomationDataResolverService,
          useValue: {},
        },
        {
          provide: AutomationTemplateService,
          useValue: {},
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
