import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { EmailService } from "src/common/emails/emails.service";
import { EmailTemplateManagementService } from "src/email-templates/services/email-template-management.service";
import { EmailTemplateRenderingService } from "src/email-templates/services/email-template-rendering.service";
import { EmailTemplateValidationService } from "src/email-templates/services/email-template-validation.service";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import { AutomationRecipientOptionsRepository } from "../repositories/automation-recipient-options.repository";

import { AutomationDefinitionStorageService } from "./automation-definition-storage.service";
import { AutomationValidationAndSimulationService } from "./automation-validation-and-simulation.service";

import type { SimulateAutomationBody } from "../schema/automation.schema";

const actor = {
  userId: "actor",
  tenantId: "tenant",
  email: "admin@example.com",
  roleSlugs: ["admin"],
  permissions: [],
};
const automationId = "00000000-0000-4000-8000-000000000001";
const input: SimulateAutomationBody = {
  automationId,
  language: "pl",
  workflow: {
    rootStepId: "00000000-0000-4000-8000-000000000004",
    steps: [
      {
        id: "00000000-0000-4000-8000-000000000004",
        type: "trigger",
        parentId: null,
        position: 0,
        config: { eventKind: "welcome" },
      },
    ],
  },
  sampleValues: { courses_link: "https://example.com/private-sample" },
};

describe("Automation simulation activity", () => {
  const publish = jest.fn();
  const getAutomation = jest.fn();
  let service: AutomationValidationAndSimulationService;

  beforeEach(async () => {
    jest.resetAllMocks();
    getAutomation.mockResolvedValue({ id: automationId, name: "Welcome", baseLanguage: "en" });
    const module = await Test.createTestingModule({
      providers: [
        AutomationValidationAndSimulationService,
        { provide: OutboxPublisher, useValue: { publish } },
        { provide: AutomationDefinitionStorageService, useValue: { getAutomation } },
        ...[
          EmailService,
          EmailTemplateManagementService,
          EmailTemplateRenderingService,
          EmailTemplateValidationService,
          LocalizationService,
          AutomationRecipientOptionsRepository,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();
    service = module.get(AutomationValidationAndSimulationService);
    jest.spyOn(service, "collectAutomationReadinessIssues").mockResolvedValue([]);
  });

  it("links a successful simulation to the tenant-scoped saved automation", async () => {
    const result = await service.simulateAutomation(input, actor);
    expect(result.issues).toEqual([]);
    expect(getAutomation).toHaveBeenCalledWith(automationId, undefined, false, "pl");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].data).toMatchObject({
      actor,
      operation: "simulate_automation",
      resourceId: automationId,
      context: {
        name: "Welcome",
        language: "pl",
        outcome: "success",
        issueCount: "0",
        previewCount: "0",
      },
    });
    expect(JSON.stringify(publish.mock.calls[0][0])).not.toContain("private-sample");
    expect(publish.mock.calls[0][0].data).not.toHaveProperty("resource");
  });

  it("records simulations of unsaved workflows without a fabricated resource ID", async () => {
    await service.simulateAutomation({ ...input, automationId: undefined }, actor);
    expect(getAutomation).not.toHaveBeenCalled();
    expect(publish.mock.calls[0][0].data.resourceId).toBeUndefined();
    expect(publish.mock.calls[0][0].data.context.savedAutomation).toBe("false");
  });

  it("records validation issues returned before previews are generated", async () => {
    jest.spyOn(service, "collectAutomationReadinessIssues").mockRestore();
    const result = await service.simulateAutomation(
      { ...input, workflow: { rootStepId: null, steps: [] } },
      actor,
    );
    expect(result.issues.length).toBeGreaterThan(0);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].data.context).toMatchObject({
      outcome: "issues_found",
      issueCount: String(result.issues.length),
      issueCodes: JSON.stringify(result.issues.map((issue) => issue.code)),
    });
  });

  it("rejects a missing or inaccessible automation before evaluating or logging it", async () => {
    getAutomation.mockRejectedValue(new NotFoundException());
    await expect(service.simulateAutomation(input, actor)).rejects.toThrow(NotFoundException);
    expect(service.collectAutomationReadinessIssues).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not record a completed simulation after an unexpected evaluation failure", async () => {
    jest
      .spyOn(service, "collectAutomationReadinessIssues")
      .mockRejectedValue(new Error("evaluation failed"));
    await expect(service.simulateAutomation(input, actor)).rejects.toThrow("evaluation failed");
    expect(publish).not.toHaveBeenCalled();
  });
});
