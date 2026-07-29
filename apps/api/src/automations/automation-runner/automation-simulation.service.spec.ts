import { Test } from "@nestjs/testing";

import { AutomationSimulationService } from "./automation-simulation.service";
import { AutomationSystemTemplatePreviewService } from "./automation-system-template-preview.service";
import { AutomationTemplateService } from "./automation-template.service";

import type { RunSimulationBody, SimulationNodeDto } from "./automation-simulation.types";
import type { TestingModule } from "@nestjs/testing";

describe("AutomationSimulationService", () => {
  let service: AutomationSimulationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationSimulationService,
        {
          provide: AutomationSystemTemplatePreviewService,
          useValue: {
            renderPreview: jest.fn().mockResolvedValue({
              subject: "Test Subject",
              html: "<p>Test</p>",
            }),
          },
        },
        {
          provide: AutomationTemplateService,
          useValue: {
            getTemplate: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get(AutomationSimulationService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("runSimulation — system template validation", () => {
    const buildNodes = (overrides?: {
      triggerType?: string;
      emailTemplate?: string;
      language?: string;
      placeholderValues?: Record<string, string>;
    }): SimulationNodeDto[] => [
      {
        id: "trigger-1",
        kind: "trigger",
        type: (overrides?.triggerType ?? "user_invited") as any,
        label: "Trigger",
        parentId: null,
        children: ["action-1"],
        config: {},
      },
      {
        id: "action-1",
        kind: "action",
        type: "send_email" as any,
        label: "Send email",
        parentId: "trigger-1",
        children: [],
        config: {
          emailTemplate: overrides?.emailTemplate ?? "user_invite",
          language: overrides?.language ?? "user_default",
          placeholderValues: overrides?.placeholderValues ?? {},
        },
      },
    ];

    it("does NOT require placeholder mapping for system templates", async () => {
      const body: RunSimulationBody = {
        nodes: buildNodes({
          emailTemplate: "user_invite",
          placeholderValues: {}, // No mappings — should pass for system templates
        }),
        language: "en",
      };

      const result = await service.runSimulation(body);

      expect(result.overallStatus).toBe("success");

      const actionResult = result.nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("valid");
      expect(actionResult?.errors).toHaveLength(0);
    });

    it("does NOT require placeholder mapping for any system template (welcome)", async () => {
      const body: RunSimulationBody = {
        nodes: buildNodes({
          triggerType: "user_welcome",
          emailTemplate: "welcome",
          placeholderValues: {},
        }),
        language: "pl",
      };

      const result = await service.runSimulation(body);

      expect(result.overallStatus).toBe("success");
      const actionResult = result.nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("valid");
    });

    it("does NOT require placeholder mapping for certificate_expiration_warning", async () => {
      const body: RunSimulationBody = {
        nodes: buildNodes({
          triggerType: "certificate_expiration_warning",
          emailTemplate: "certificate_expiration_warning",
          placeholderValues: {},
        }),
        language: "en",
      };

      const result = await service.runSimulation(body);

      expect(result.overallStatus).toBe("success");
      const actionResult = result.nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("valid");
    });

    it("reports errors for custom template with unmapped placeholders", async () => {
      const body: RunSimulationBody = {
        nodes: buildNodes({
          emailTemplate: "custom-template-uuid",
          placeholderValues: {
            recipientName: "", // empty = unmapped
            courseTitle: "courseName", // mapped
          },
        }),
        language: "en",
      };

      const result = await service.runSimulation(body);

      expect(result.overallStatus).toBe("failed");
      const actionResult = result.nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("invalid");
      expect(actionResult?.errors.some((e) => e.field === "placeholderValues.recipientName")).toBe(
        true,
      );
    });

    it("passes validation for custom template with all placeholders mapped", async () => {
      const body: RunSimulationBody = {
        nodes: buildNodes({
          emailTemplate: "custom-template-uuid",
          placeholderValues: {
            recipientName: "userFirstName",
            courseTitle: "courseName",
          },
        }),
        language: "en",
      };

      const result = await service.runSimulation(body);

      expect(result.overallStatus).toBe("success");
      const actionResult = result.nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.status).toBe("valid");
      expect(actionResult?.errors).toHaveLength(0);
    });

    it("fails when emailTemplate is missing", async () => {
      const nodes: SimulationNodeDto[] = [
        {
          id: "trigger-1",
          kind: "trigger",
          type: "user_invited" as any,
          label: "Trigger",
          parentId: null,
          children: ["action-1"],
          config: {},
        },
        {
          id: "action-1",
          kind: "action",
          type: "send_email" as any,
          label: "Send email",
          parentId: "trigger-1",
          children: [],
          config: {
            language: "user_default",
          },
        },
      ];

      const body: RunSimulationBody = { nodes, language: "en" };
      const result = await service.runSimulation(body);

      expect(result.overallStatus).toBe("failed");
      const actionResult = result.nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.errors.some((e) => e.field === "emailTemplate")).toBe(true);
    });

    it("fails when language is missing", async () => {
      const nodes: SimulationNodeDto[] = [
        {
          id: "trigger-1",
          kind: "trigger",
          type: "user_invited" as any,
          label: "Trigger",
          parentId: null,
          children: ["action-1"],
          config: {},
        },
        {
          id: "action-1",
          kind: "action",
          type: "send_email" as any,
          label: "Send email",
          parentId: "trigger-1",
          children: [],
          config: {
            emailTemplate: "user_invite",
          },
        },
      ];

      const body: RunSimulationBody = { nodes, language: "en" };
      const result = await service.runSimulation(body);

      expect(result.overallStatus).toBe("failed");
      const actionResult = result.nodeResults.find((n) => n.kind === "action");
      expect(actionResult?.errors.some((e) => e.field === "language")).toBe(true);
    });
  });
});
