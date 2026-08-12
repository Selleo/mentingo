import { Test } from "@nestjs/testing";

import { BaseResponse } from "src/common";

import { AutomationLogsRepository } from "../repositories/automation-logs/automation-logs";

import { AutomationLogsController } from "./automation-logs.controller";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationLogsController", () => {
  let controller: AutomationLogsController;
  let repository: jest.Mocked<AutomationLogsRepository>;

  const automationId = "auto-1" as UUIDType;

  const mockLogs = [
    { id: "log-1", automationId, status: "success", createdAt: "2025-07-01" },
    { id: "log-2", automationId, status: "failed", createdAt: "2025-07-02" },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationLogsController],
      providers: [
        {
          provide: AutomationLogsRepository,
          useValue: {
            getAll: jest.fn(),
            getByAutomationId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AutomationLogsController);
    repository = module.get(AutomationLogsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("returns all logs wrapped in BaseResponse", async () => {
      repository.getAll.mockResolvedValue(mockLogs as any);

      const result = await controller.getAll();

      expect(repository.getAll).toHaveBeenCalled();
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(mockLogs);
    });

    it("returns empty array when no logs exist", async () => {
      repository.getAll.mockResolvedValue([]);

      const result = await controller.getAll();

      expect(result.data).toEqual([]);
    });
  });

  describe("getByAutomationId", () => {
    it("returns logs for specific automation wrapped in BaseResponse", async () => {
      repository.getByAutomationId.mockResolvedValue(mockLogs as any);

      const result = await controller.getByAutomationId(automationId);

      expect(repository.getByAutomationId).toHaveBeenCalledWith(automationId);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(mockLogs);
    });

    it("returns empty array when no logs for automation", async () => {
      repository.getByAutomationId.mockResolvedValue([]);

      const result = await controller.getByAutomationId(automationId);

      expect(result.data).toEqual([]);
    });
  });
});
