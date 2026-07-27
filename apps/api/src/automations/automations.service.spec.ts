import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AutomationStatus } from "src/announcements/types/automations.types";

import { AutomationsService } from "./automations.service";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationsService", () => {
  let service: AutomationsService;
  let repository: jest.Mocked<AutomationsRepository>;

  const tenantId = "tenant-1" as UUIDType;
  const automationId = "auto-1" as UUIDType;

  const mockAutomation = {
    id: automationId,
    name: { pl: "Test" },
    description: { pl: "Opis" },
    status: "draft",
    tenantId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsService,
        {
          provide: AutomationsRepository,
          useValue: {
            getAllAutomationsByTenantId: jest.fn(),
            getAutomationById: jest.fn(),
            createAutomation: jest.fn(),
            updateAutomation: jest.fn(),
            changeStatus: jest.fn(),
            deleteAutomation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AutomationsService>(AutomationsService);
    repository = module.get(AutomationsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createAutomation", () => {
    it("delegates to repository and returns created automation", async () => {
      repository.createAutomation.mockResolvedValue(mockAutomation as any);

      const input = {
        name: { pl: "Test" },
        description: { pl: "Opis" },
        status: AutomationStatus.Draft,
      };
      const result = await service.createAutomation(input);

      expect(repository.createAutomation).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockAutomation);
    });
  });

  describe("getAllAutomations", () => {
    it("returns all automations for given tenant", async () => {
      repository.getAllAutomationsByTenantId.mockResolvedValue([mockAutomation] as any);

      const result = await service.getAllAutomations(tenantId);

      expect(repository.getAllAutomationsByTenantId).toHaveBeenCalledWith(tenantId);
      expect(result).toHaveLength(1);
    });
  });

  describe("getAutomationById", () => {
    it("returns automation when found", async () => {
      repository.getAutomationById.mockResolvedValue(mockAutomation as any);

      const result = await service.getAutomationById(automationId);

      expect(result).toEqual(mockAutomation);
    });

    it("throws BadRequestException when automation not found", async () => {
      repository.getAutomationById.mockResolvedValue(undefined as any);

      await expect(service.getAutomationById(automationId)).rejects.toThrow(BadRequestException);
      await expect(service.getAutomationById(automationId)).rejects.toThrow("Automation not found");
    });
  });

  describe("updateAutomation", () => {
    it("returns updated id on success", async () => {
      repository.updateAutomation.mockResolvedValue(automationId);

      const result = await service.updateAutomation(automationId, { name: { pl: "Updated" } });

      expect(result).toBe(automationId);
    });

    it("throws BadRequestException when update fails", async () => {
      repository.updateAutomation.mockResolvedValue(undefined as any);

      await expect(
        service.updateAutomation(automationId, { name: { pl: "Fail" } }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updateStatus", () => {
    it("returns updated id on success", async () => {
      repository.changeStatus.mockResolvedValue(automationId);

      const result = await service.updateStatus(automationId, AutomationStatus.Enabled);

      expect(repository.changeStatus).toHaveBeenCalledWith(automationId, AutomationStatus.Enabled);
      expect(result).toBe(automationId);
    });

    it("throws BadRequestException when status change fails", async () => {
      repository.changeStatus.mockResolvedValue(undefined as any);

      await expect(service.updateStatus(automationId, AutomationStatus.Enabled)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("deleteAutomation", () => {
    it("returns deleted record on success", async () => {
      repository.deleteAutomation.mockResolvedValue(mockAutomation as any);

      const result = await service.deleteAutomation(automationId);

      expect(repository.deleteAutomation).toHaveBeenCalledWith(automationId);
      expect(result).toEqual(mockAutomation);
    });

    it("throws BadRequestException when delete fails", async () => {
      repository.deleteAutomation.mockResolvedValue(undefined as any);

      await expect(service.deleteAutomation(automationId)).rejects.toThrow(BadRequestException);
    });
  });
});
