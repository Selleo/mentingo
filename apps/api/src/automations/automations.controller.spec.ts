import { Test } from "@nestjs/testing";

import { AutomationStatus } from "src/announcements/types/automations.types";
import { BaseResponse } from "src/common";

import { AutomationSimulationService } from "./automation-runner/automation-simulation.service";
import { AutomationSystemTemplatePreviewService } from "./automation-runner/automation-system-template-preview.service";
import { AutomationsSeedDefaultsService } from "./automations-seed-defaults.service";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationsController", () => {
  let controller: AutomationsController;
  let service: jest.Mocked<AutomationsService>;
  let simulationService: jest.Mocked<AutomationSimulationService>;
  let templatePreviewService: jest.Mocked<AutomationSystemTemplatePreviewService>;

  const tenantId = "tenant-1" as UUIDType;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationsController],
      providers: [
        {
          provide: AutomationsService,
          useValue: {
            createAutomation: jest.fn(),
            getAllAutomations: jest.fn(),
            getAutomationById: jest.fn(),
            updateAutomation: jest.fn(),
            updateStatus: jest.fn(),
            saveAutomation: jest.fn(),
            deleteAutomation: jest.fn(),
          },
        },
        {
          provide: AutomationSystemTemplatePreviewService,
          useValue: {
            renderPreview: jest.fn(),
          },
        },
        {
          provide: AutomationSimulationService,
          useValue: {
            runSimulation: jest.fn(),
          },
        },
        {
          provide: AutomationsSeedDefaultsService,
          useValue: {
            seedDefaults: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AutomationsController);
    service = module.get(AutomationsService);
    simulationService = module.get(AutomationSimulationService);
    templatePreviewService = module.get(AutomationSystemTemplatePreviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAllAutomations", () => {
    it("returns all automations wrapped in BaseResponse", async () => {
      const automations = [
        { id: "auto-1", name: { en: "First" }, status: "draft" },
        { id: "auto-2", name: { en: "Second" }, status: "enabled" },
      ];
      service.getAllAutomations.mockResolvedValue(automations as any);

      const result = await controller.getAllAutomations(tenantId);

      expect(service.getAllAutomations).toHaveBeenCalledWith(tenantId);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(automations);
    });

    it("returns empty array when no automations exist", async () => {
      service.getAllAutomations.mockResolvedValue([]);

      const result = await controller.getAllAutomations(tenantId);

      expect(result.data).toEqual([]);
    });
  });

  describe("getAutomationById", () => {
    it("returns automation wrapped in BaseResponse", async () => {
      const automation = { id: "auto-1", name: { en: "Test" }, status: "draft" };
      service.getAutomationById.mockResolvedValue(automation as any);

      const result = await controller.getAutomationById("auto-1" as UUIDType);

      expect(service.getAutomationById).toHaveBeenCalledWith("auto-1");
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(automation);
    });
  });

  describe("createAutomation", () => {
    it("creates automation and returns BaseResponse", async () => {
      const input = {
        name: { en: "New Automation" },
        description: { en: "Description" },
        status: AutomationStatus.Draft,
      };
      const createdAutomation = { id: "auto-new", ...input };
      service.createAutomation.mockResolvedValue(createdAutomation as any);

      const result = await controller.createAutomation(input);

      expect(service.createAutomation).toHaveBeenCalledWith(input);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(createdAutomation);
    });
  });

  describe("updateAutomation", () => {
    it("updates automation and returns BaseResponse with id", async () => {
      service.updateAutomation.mockResolvedValue("auto-1" as UUIDType);

      const input = { name: { en: "Updated" } };
      const result = await controller.updateAutomation("auto-1" as UUIDType, input);

      expect(service.updateAutomation).toHaveBeenCalledWith("auto-1", input);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ id: "auto-1" });
    });
  });

  describe("updateStatus", () => {
    it("updates status and returns BaseResponse with id", async () => {
      service.updateStatus.mockResolvedValue("auto-1" as UUIDType);

      const result = await controller.updateStatus("auto-1" as UUIDType, {
        status: AutomationStatus.Enabled,
      });

      expect(service.updateStatus).toHaveBeenCalledWith("auto-1", AutomationStatus.Enabled);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual({ id: "auto-1" });
    });
  });

  describe("deleteAutomation", () => {
    it("deletes automation and returns BaseResponse", async () => {
      const deletedRecord = { id: "auto-1", name: { en: "Deleted" } };
      service.deleteAutomation.mockResolvedValue(deletedRecord as any);

      const result = await controller.deleteAutomation("auto-1" as UUIDType);

      expect(service.deleteAutomation).toHaveBeenCalledWith("auto-1");
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(deletedRecord);
    });
  });

  describe("previewSystemTemplate", () => {
    it("returns rendered template preview", async () => {
      const preview = { subject: "Welcome", html: "<h1>Hello</h1>" };
      templatePreviewService.renderPreview.mockResolvedValue(preview as any);

      const result = await controller.previewSystemTemplate("template-1", "en");

      expect(templatePreviewService.renderPreview).toHaveBeenCalledWith("template-1", "en");
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(preview);
    });

    it("defaults to Polish language when no language provided", async () => {
      const preview = { subject: "Witaj", html: "<h1>Cześć</h1>" };
      templatePreviewService.renderPreview.mockResolvedValue(preview as any);

      const result = await controller.previewSystemTemplate("template-1", undefined);

      expect(templatePreviewService.renderPreview).toHaveBeenCalledWith("template-1", "pl");
      expect(result.data).toEqual(preview);
    });

    it("returns empty subject and html when preview is null", async () => {
      templatePreviewService.renderPreview.mockResolvedValue(null as any);

      const result = await controller.previewSystemTemplate("template-1", "en");

      expect(result.data).toEqual({ subject: "", html: "" });
    });
  });

  describe("runSimulation", () => {
    it("runs simulation and returns BaseResponse with result", async () => {
      const simulationResult = { success: true, steps: [] };
      simulationService.runSimulation.mockResolvedValue(simulationResult as any);

      const body = { automationId: "auto-1", triggerData: {} } as any;
      const result = await controller.runSimulation(body);

      expect(simulationService.runSimulation).toHaveBeenCalledWith(body);
      expect(result).toBeInstanceOf(BaseResponse);
      expect(result.data).toEqual(simulationResult);
    });
  });
});
