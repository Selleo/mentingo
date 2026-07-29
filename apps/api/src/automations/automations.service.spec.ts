import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AutomationsService } from "./automations.service";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationsService", () => {
  let service: AutomationsService;
  let repository: jest.Mocked<AutomationsRepository>;

  const tenantId = "tenant-1" as UUIDType;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsService,
        {
          provide: AutomationsRepository,
          useValue: {
            createAutomation: jest.fn(),
            getAllAutomationsByTenantId: jest.fn(),
            getAutomationById: jest.fn(),
            updateAutomation: jest.fn(),
            changeStatus: jest.fn(),
            deleteAutomation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AutomationsService);
    repository = module.get(AutomationsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createAutomation", () => {
    it("delegates creation to repository and returns result", async () => {
      const input = {
        name: { en: "Test Automation" },
        description: { en: "Test description" },
        status: "draft" as const,
      };
      const createdRecord = { id: "auto-1", ...input, tenantId, createdAt: new Date() };
      repository.createAutomation.mockResolvedValue(createdRecord as any);

      const result = await service.createAutomation(input);

      expect(repository.createAutomation).toHaveBeenCalledWith(input);
      expect(result).toEqual(createdRecord);
    });
  });

  describe("getAllAutomations", () => {
    it("returns all automations for given tenant", async () => {
      const automations = [
        { id: "auto-1", name: { en: "First" }, status: "draft" },
        { id: "auto-2", name: { en: "Second" }, status: "enabled" },
      ];
      repository.getAllAutomationsByTenantId.mockResolvedValue(automations as any);

      const result = await service.getAllAutomations(tenantId);

      expect(repository.getAllAutomationsByTenantId).toHaveBeenCalledWith(tenantId);
      expect(result).toEqual(automations);
    });

    it("returns empty array when no automations exist", async () => {
      repository.getAllAutomationsByTenantId.mockResolvedValue([]);

      const result = await service.getAllAutomations(tenantId);

      expect(result).toEqual([]);
    });
  });

  describe("getAutomationById", () => {
    it("returns automation when found", async () => {
      const automation = { id: "auto-1", name: { en: "Found" }, status: "draft" };
      repository.getAutomationById.mockResolvedValue(automation as any);

      const result = await service.getAutomationById("auto-1" as UUIDType);

      expect(result).toEqual(automation);
    });

    it("throws BadRequestException when automation not found", async () => {
      repository.getAutomationById.mockResolvedValue(undefined as any);

      await expect(service.getAutomationById("missing" as UUIDType)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateAutomation", () => {
    it("returns updated id on success", async () => {
      repository.updateAutomation.mockResolvedValue("auto-1" as UUIDType);

      const input = { name: { en: "Updated Name" } };
      const result = await service.updateAutomation("auto-1" as UUIDType, input);

      expect(repository.updateAutomation).toHaveBeenCalledWith("auto-1", input);
      expect(result).toBe("auto-1");
    });

    it("throws BadRequestException when update returns null", async () => {
      repository.updateAutomation.mockResolvedValue(null as any);

      const input = { name: { en: "Updated" } };

      await expect(service.updateAutomation("auto-1" as UUIDType, input)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateStatus", () => {
    it("returns updated id on success", async () => {
      repository.changeStatus.mockResolvedValue("auto-1" as UUIDType);

      const result = await service.updateStatus("auto-1" as UUIDType, "enabled");

      expect(repository.changeStatus).toHaveBeenCalledWith("auto-1", "enabled");
      expect(result).toBe("auto-1");
    });

    it("throws BadRequestException when status change returns null", async () => {
      repository.changeStatus.mockResolvedValue(null as any);

      await expect(service.updateStatus("auto-1" as UUIDType, "enabled")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("deleteAutomation", () => {
    it("returns deleted record on success", async () => {
      const deletedRecord = { id: "auto-1", name: { en: "Deleted" } };
      repository.deleteAutomation.mockResolvedValue(deletedRecord as any);

      const result = await service.deleteAutomation("auto-1" as UUIDType);

      expect(repository.deleteAutomation).toHaveBeenCalledWith("auto-1");
      expect(result).toEqual(deletedRecord);
    });

    it("throws BadRequestException when delete returns null", async () => {
      repository.deleteAutomation.mockResolvedValue(null as any);

      await expect(service.deleteAutomation("auto-1" as UUIDType)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
