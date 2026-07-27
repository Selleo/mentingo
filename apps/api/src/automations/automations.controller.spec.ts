import { Test } from "@nestjs/testing";

import { BaseResponse } from "src/common";

import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationsController", () => {
  let controller: AutomationsController;
  let service: jest.Mocked<AutomationsService>;

  const tenantId = "tenant-1" as UUIDType;
  const automationId = "auto-1" as UUIDType;

  const mockAutomation = {
    id: automationId,
    name: { pl: "Automation" },
    description: { pl: "Desc" },
    status: "draft",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationsController],
      providers: [
        {
          provide: AutomationsService,
          useValue: {
            getAllAutomations: jest.fn(),
            getAutomationById: jest.fn(),
            createAutomation: jest.fn(),
            updateAutomation: jest.fn(),
            updateStatus: jest.fn(),
            deleteAutomation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AutomationsController);
    service = module.get(AutomationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllAutomations", () => {
    it("returns BaseResponse wrapping automations list", async () => {
      service.getAllAutomations.mockResolvedValue([mockAutomation] as any);

      const result = await controller.getAllAutomations(tenantId);

      expect(service.getAllAutomations).toHaveBeenCalledWith(tenantId);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual([mockAutomation]);
    });
  });

  describe("getAutomationById", () => {
    it("returns BaseResponse wrapping single automation", async () => {
      service.getAutomationById.mockResolvedValue(mockAutomation as any);

      const result = await controller.getAutomationById(automationId);

      expect(service.getAutomationById).toHaveBeenCalledWith(automationId);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(mockAutomation);
    });
  });

  describe("createAutomation", () => {
    it("delegates to service and wraps response", async () => {
      service.createAutomation.mockResolvedValue(mockAutomation as any);

      const input = { name: { pl: "Test" }, description: { pl: "" }, status: "draft" as const };
      const result = await controller.createAutomation(input);

      expect(service.createAutomation).toHaveBeenCalledWith(input);
      expect(result).toBeInstanceOf(BaseResponse);
    });
  });

  describe("updateStatus", () => {
    it("calls updateStatus with id and status", async () => {
      service.updateStatus.mockResolvedValue(automationId);

      const result = await controller.updateStatus(automationId, { status: "enabled" as any });

      expect(service.updateStatus).toHaveBeenCalledWith(automationId, "enabled");
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ id: automationId });
    });
  });

  describe("updateAutomation", () => {
    it("calls updateAutomation with id and input", async () => {
      service.updateAutomation.mockResolvedValue(automationId);

      const input = { name: { pl: "Updated" } };
      const result = await controller.updateAutomation(automationId, input);

      expect(service.updateAutomation).toHaveBeenCalledWith(automationId, input);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ id: automationId });
    });
  });

  describe("deleteAutomation", () => {
    it("calls deleteAutomation and wraps result", async () => {
      service.deleteAutomation.mockResolvedValue(mockAutomation as any);

      const result = await controller.deleteAutomation(automationId);

      expect(service.deleteAutomation).toHaveBeenCalledWith(automationId);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(mockAutomation);
    });
  });
});
