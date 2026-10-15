import { Test } from "@nestjs/testing";
import { AUTOMATION_STATUSES } from "@repo/shared";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { AutomationActivityHandler } from "src/activity-logs/handlers/automation-activity.handler";
import { getActivityLogMetadataResourceName } from "src/activity-logs/utils/get-activity-log-metadata-resource-name";
import { BUILT_IN_AUTOMATIONS } from "src/automation-execution/catalog";
import { AutomationActivityEvent } from "src/events/automation/automation-activity.event";
import { LocalizationService } from "src/localization/localization.service";
import { materializeLegacyEvent } from "src/outbox/outbox.event-registry";
import { OutboxPublisher } from "src/outbox/outbox.publisher";

import { AUTOMATION_RUNTIME, AUTOMATION_LIFECYCLE_ACTIVITY_TYPES } from "../automation.constants";
import { AutomationRecipientOptionsRepository } from "../repositories/automation-recipient-options.repository";

import { AutomationDefinitionStorageService } from "./automation-definition-storage.service";
import { AutomationManagementService } from "./automation-management.service";
import { AutomationValidationAndSimulationService } from "./automation-validation-and-simulation.service";

import type { AutomationRecord } from "../automation.types";

const actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  email: "admin@example.com",
  roleSlugs: ["admin"],
  permissions: [],
};
const definition = {
  name: "Onboarding",
  description: "Welcome",
  workflow: { rootStepId: null, steps: [] },
};

function makeRecord(): AutomationRecord {
  return {
    id: "00000000-0000-4000-8000-000000000003",
    tenantId: actor.tenantId,
    ...definition,
    draftDefinition: definition,
    appliedDefinition: null,
    status: AUTOMATION_STATUSES.DISABLED,
    executionVersion: 0,
    baseLanguage: "en",
    availableLocales: ["en"],
    hasLocalizedMetadataChanges: false,
    builtInKey: null,
    draftRootStepId: null,
    appliedRootStepId: null,
    appliedName: null,
    appliedDescription: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("Automation activity lifecycle", () => {
  const transaction = { execute: jest.fn() };
  const storage = {
    withAutomationTransaction: jest.fn(),
    getAutomation: jest.fn(),
    createAutomation: jest.fn(),
    updateAutomation: jest.fn(),
    deleteAutomation: jest.fn(),
    getAutomationLocalizedMetadata: jest.fn(),
  };
  const runtime = { cancelPendingAutomationEmailDeliveries: jest.fn() };
  const validation = { assertAutomationReady: jest.fn() };
  const publish = jest.fn();
  const recordActivity = jest.fn();
  let current: AutomationRecord;
  let service: AutomationManagementService;
  let handler: AutomationActivityHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    current = makeRecord();
    storage.withAutomationTransaction.mockImplementation(async (callback) => callback(transaction));
    storage.getAutomation.mockImplementation(async () => current);
    storage.createAutomation.mockImplementation(async (input) => ({ ...current, ...input }));
    storage.updateAutomation.mockImplementation(async (_id, input) => ({ ...current, ...input }));
    storage.getAutomationLocalizedMetadata.mockResolvedValue({
      name: { en: current.name },
      description: { en: current.description },
      baseLanguage: "en",
      availableLocales: ["en"],
    });
    const module = await Test.createTestingModule({
      providers: [
        AutomationManagementService,
        AutomationActivityHandler,
        { provide: AutomationDefinitionStorageService, useValue: storage },
        { provide: AutomationRecipientOptionsRepository, useValue: {} },
        { provide: AutomationValidationAndSimulationService, useValue: validation },
        { provide: OutboxPublisher, useValue: { publish } },
        { provide: ActivityLogsService, useValue: { recordActivity } },
        { provide: LocalizationService, useValue: {} },
        { provide: AUTOMATION_RUNTIME, useValue: runtime },
      ],
    }).compile();
    service = module.get(AutomationManagementService);
    handler = module.get(AutomationActivityHandler);
  });

  async function loggedAction(action: string) {
    expect(publish).toHaveBeenCalledTimes(1);
    const [event, handle] = publish.mock.calls[0];
    expect(handle).toBe(transaction);
    expect(event).toBeInstanceOf(AutomationActivityEvent);
    const restored = materializeLegacyEvent(
      event.constructor.name,
      JSON.parse(JSON.stringify(event)),
    );
    await handler.handle(restored as AutomationActivityEvent);
    const log = recordActivity.mock.calls[0][0];
    expect(log).toMatchObject({ actor, operation: action, resourceType: "automation" });
    expect(getActivityLogMetadataResourceName(log, "automation")).toBeTruthy();
    return log;
  }

  it("records creation in the same transaction as the new draft", async () => {
    const result = await service.createAutomation(definition, actor, "pl");
    const log = await loggedAction("create");
    expect(log).toMatchObject({
      resourceId: result.id,
      before: null,
      after: { name: definition.name },
      context: { language: "pl" },
    });
    expect(storage.createAutomation.mock.calls[0][1]).toBe(transaction);
  });

  it("identifies creation from a built-in template", async () => {
    const key = BUILT_IN_AUTOMATIONS[0].templateKey;
    await service.createAutomationFromTemplate(key, actor);
    expect((await loggedAction("create")).context.templateKey).toBe(key);
  });

  it("records precise draft changes and preserves the live definition", async () => {
    const workflow = { rootStepId: null, steps: [] };
    current.appliedDefinition = definition;
    await service.updateAutomation(
      current.id,
      { name: "New name", description: "New description", workflow },
      actor,
      "pl",
    );
    const log = await loggedAction("save_automation_draft");
    expect(log.changedFields).toEqual(["name", "description", "draftDefinition"]);
    expect(log.before.name).toBe("Onboarding");
    expect(log.after.name).toBe("New name");
    expect(log.changedFields).not.toContain("appliedDefinition");
    expect(log.context.language).toBe("pl");
  });

  it("captures workflow-only edits including recipient and mapping changes", async () => {
    const draft = await service.createAutomationFromTemplate(
      BUILT_IN_AUTOMATIONS[0].templateKey,
      actor,
    );
    current.draftDefinition = {
      name: draft.name,
      description: draft.description,
      workflow: draft.workflow,
    };
    const workflow = {
      ...draft.workflow,
      steps: draft.workflow.steps.map((step) =>
        step.type === "send_email"
          ? {
              ...step,
              config: { ...step.config, recipients: { type: "everyone" as const }, mappings: {} },
            }
          : step,
      ),
    };
    publish.mockClear();
    await service.updateAutomation(current.id, { workflow }, actor);
    const log = await loggedAction("save_automation_draft");
    expect(log.changedFields).toEqual(["draftDefinition"]);
    expect(JSON.parse(log.after.draftDefinition).workflow).toEqual(workflow);
    expect(JSON.parse(log.before.draftDefinition).workflow).toEqual(draft.workflow);
  });

  it("records an unchanged explicit save without inventing changed fields", async () => {
    await service.updateAutomation(current.id, definition, actor);
    expect((await loggedAction("save_automation_draft")).changedFields).toEqual([]);
  });

  it("applies editor changes atomically with only a publish activity", async () => {
    const edited = { ...definition, name: "Updated onboarding", description: "Updated welcome" };
    await service.changeAutomationLifecycle(current.id, "apply", actor, "pl", edited);

    expect(storage.updateAutomation).toHaveBeenCalledTimes(1);
    expect(storage.updateAutomation).toHaveBeenCalledWith(
      current.id,
      {
        name: edited.name,
        description: edited.description,
        draftDefinition: edited,
        appliedDefinition: edited,
        status: current.status,
        executionVersion: 1,
      },
      transaction,
      "pl",
    );
    expect(validation.assertAutomationReady).toHaveBeenCalledWith(
      edited.workflow,
      current.id,
      actor.tenantId,
    );
    const log = await loggedAction("apply_automation");
    expect(log.before.name).toBe(current.name);
    expect(log.after.name).toBe(edited.name);
    expect(log.changedFields).toContain("draftDefinition");
    expect(log.changedFields).toContain("appliedDefinition");
  });

  it("does not save or log editor changes when applying fails validation", async () => {
    validation.assertAutomationReady.mockRejectedValue(new Error("invalid workflow"));
    await expect(
      service.changeAutomationLifecycle(current.id, "apply", actor, "en", definition),
    ).rejects.toThrow("invalid workflow");
    expect(storage.updateAutomation).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(Object.entries(AUTOMATION_LIFECYCLE_ACTIVITY_TYPES))(
    "records %s",
    async (operation, action) => {
      if (operation === "disable") current.status = AUTOMATION_STATUSES.ENABLED;
      await service.changeAutomationLifecycle(
        current.id,
        operation as keyof typeof AUTOMATION_LIFECYCLE_ACTIVITY_TYPES,
        actor,
      );
      const log = await loggedAction(action);
      expect(log.changedFields).toContain("executionVersion");
      expect(log.after.executionVersion).toBe("1");
      expect(runtime.cancelPendingAutomationEmailDeliveries).toHaveBeenCalledWith(
        transaction,
        current.id,
        `automation_${operation}`,
      );
      if (operation === "apply" || operation === "enable") {
        expect(log.changedFields).toContain("appliedDefinition");
      }
    },
  );

  it.each(["enable", "disable", "archive"] as const)(
    "does not log repeated %s",
    async (operation) => {
      current.status = {
        enable: AUTOMATION_STATUSES.ENABLED,
        disable: AUTOMATION_STATUSES.DISABLED,
        archive: AUTOMATION_STATUSES.ARCHIVED,
      }[operation];
      await service.changeAutomationLifecycle(current.id, operation, actor);
      expect(publish).not.toHaveBeenCalled();
      expect(storage.updateAutomation).not.toHaveBeenCalled();
    },
  );

  it("identifies the source of a duplicate", async () => {
    await service.duplicateAutomation(current.id, actor);
    const log = await loggedAction("duplicate_automation");
    expect(log.context).toMatchObject({
      sourceAutomationId: current.id,
      sourceAutomationName: current.name,
    });
    expect(log.after.name).toBe("Onboarding (copy)");
  });

  it("preserves the deleted automation and cancels pending deliveries", async () => {
    await service.deleteAutomation(current.id, actor);
    const log = await loggedAction("delete");
    expect(log).toMatchObject({
      resourceId: current.id,
      before: { name: current.name },
      after: null,
    });
    expect(runtime.cancelPendingAutomationEmailDeliveries).toHaveBeenCalledWith(
      transaction,
      current.id,
      "automation_deleted",
    );
  });

  it("does not log a rejected lifecycle validation", async () => {
    validation.assertAutomationReady.mockRejectedValue(new Error("invalid workflow"));
    await expect(service.changeAutomationLifecycle(current.id, "apply", actor)).rejects.toThrow(
      "invalid workflow",
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not log failed writes", async () => {
    storage.updateAutomation.mockRejectedValue(new Error("write failed"));
    await expect(service.updateAutomation(current.id, definition, actor)).rejects.toThrow(
      "write failed",
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it("propagates an outbox failure to the mutation transaction", async () => {
    publish.mockRejectedValue(new Error("outbox unavailable"));
    await expect(service.createAutomation(definition, actor)).rejects.toThrow("outbox unavailable");
  });
});
