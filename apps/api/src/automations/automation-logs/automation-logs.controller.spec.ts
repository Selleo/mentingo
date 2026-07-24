import { Test } from "@nestjs/testing";

import { AutomationLogsController } from "./automation-logs.controller";
import { AutomationLogsService } from "./automation-logs.service";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationLogsController", () => {
  let controller: AutomationLogsController;

  const automationLogsServiceMock = {
    getByAutomationId: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationLogsController],
      providers: [
        {
          provide: AutomationLogsService,
          useValue: automationLogsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AutomationLogsController>(AutomationLogsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
