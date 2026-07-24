import { Test } from "@nestjs/testing";

import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

import { AutomationLogsController } from "./automation-logs.controller";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationLogsController", () => {
  let controller: AutomationLogsController;

  const automationLogsRepositoryMock = {
    GetByAutomationId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationLogsController],
      providers: [
        {
          provide: AutomationLogsRepository,
          useValue: automationLogsRepositoryMock,
        },
      ],
    }).compile();

    controller = module.get(AutomationLogsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
