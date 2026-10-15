import { randomUUID } from "node:crypto";

import { BUILT_IN_AUTOMATIONS } from "src/automation-execution/catalog";

import {
  createWelcomeAutomationDefinition,
  getFirstEmailStep,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";
import type { AutomationWorkflowTemplateResponse } from "../schema/automation.schema";
import type { AutomationDefinition } from "@repo/shared";

// Workflow edges use parentId/position; the API's flat step array is not traversal order.
const sortAutomationDefinitionSteps = (definition: AutomationDefinition | null) =>
  definition && {
    ...definition,
    workflow: {
      ...definition.workflow,
      steps: [...definition.workflow.steps].sort((left, right) => left.id.localeCompare(right.id)),
    },
  };

describe("Automation authoring and lifecycle (e2e)", () => {
  let t: AutomationTestContext;
  beforeAll(async () => {
    t = await setupAutomationTestContext();
  });
  beforeEach(async () => {
    await t.resetAutomationTestState();
  });
  afterAll(async () => {
    await t?.closeAutomationTestContext();
    jest.restoreAllMocks();
  });

  it("saves incomplete drafts but refuses to apply or enable them atomically", async () => {
    const body = {
      ...createWelcomeAutomationDefinition(),
      workflow: { rootStepId: null, steps: [] },
    };
    const draft = await t.createAutomation(body);
    expect(draft).toMatchObject({
      status: "draft",
      executionVersion: 0,
      appliedDefinition: null,
      hasUnappliedChanges: true,
    });
    for (const operation of ["apply", "enable"]) {
      const response = await t
        .requestAutomationApi("post", `/${draft.id}/${operation}`)
        .expect(422);
      expect(response.body.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "missing_trigger" })]),
      );
      expect(await t.getAutomation(draft.id)).toEqual(draft);
    }
  });

  it.each(["trigger-first", "email-first"])(
    "keeps draft edits separate, enables the applied version, and applies %s unsaved input atomically",
    async (stepOrder) => {
      const enabled = await t.createEnabledAutomation();
      expect(enabled).toMatchObject({
        status: "enabled",
        executionVersion: 1,
        hasUnappliedChanges: false,
      });
      await t
        .requestAutomationApi("patch", `/${enabled.id}`)
        .send({ name: "Draft name", workflow: { rootStepId: null, steps: [] } })
        .expect(200);
      const draft = await t.getAutomation(enabled.id);
      expect(draft).toMatchObject({
        executionVersion: 1,
        hasUnappliedChanges: true,
      });
      expect(sortAutomationDefinitionSteps(draft.appliedDefinition)).toEqual(
        sortAutomationDefinitionSteps(enabled.appliedDefinition),
      );
      await t.requestAutomationApi("post", `/${enabled.id}/disable`).expect(201);
      const reenabled = (await t.requestAutomationApi("post", `/${enabled.id}/enable`).expect(201))
        .body.data;
      expect(reenabled).toMatchObject({
        status: "enabled",
        executionVersion: 3,
      });
      expect(sortAutomationDefinitionSteps(reenabled.appliedDefinition)).toEqual(
        sortAutomationDefinitionSteps(enabled.appliedDefinition),
      );
      await t.requestAutomationApi("post", `/${enabled.id}/apply`).expect(422);
      expect(await t.getAutomation(enabled.id)).toEqual(reenabled);
      const replacement = { ...createWelcomeAutomationDefinition(), name: "Applied replacement" };
      if (stepOrder === "email-first") replacement.workflow.steps.reverse();
      const applied = (
        await t
          .requestAutomationApi("post", `/${enabled.id}/apply`)
          .send({ definition: replacement })
          .expect(201)
      ).body.data;
      expect(applied).toMatchObject({
        name: replacement.name,
        executionVersion: 4,
        hasUnappliedChanges: false,
      });
      expect(sortAutomationDefinitionSteps(applied.appliedDefinition)).toEqual(
        sortAutomationDefinitionSteps(replacement),
      );
      expect(
        sortAutomationDefinitionSteps({
          name: applied.name,
          description: applied.description,
          workflow: applied.workflow,
        }),
      ).toEqual(sortAutomationDefinitionSteps(replacement));
    },
  );

  it("applies without enabling and does not increment versions for repeated state transitions", async () => {
    const draft = await t.createAutomation();
    const applied = (await t.requestAutomationApi("post", `/${draft.id}/apply`).expect(201)).body
      .data;
    expect(applied).toMatchObject({
      status: "draft",
      executionVersion: 1,
      hasUnappliedChanges: false,
    });
    for (const operation of ["enable", "disable", "archive"]) {
      const first = (await t.requestAutomationApi("post", `/${draft.id}/${operation}`).expect(201))
        .body.data;
      expect(
        (await t.requestAutomationApi("post", `/${draft.id}/${operation}`).expect(201)).body.data,
      ).toEqual(first);
    }
    for (const operation of ["enable", "disable", "apply"])
      await t.requestAutomationApi("post", `/${draft.id}/${operation}`).expect(409);
    await t
      .requestAutomationApi("patch", `/${draft.id}`)
      .send({ name: "Forbidden edit" })
      .expect(409);
    await t.requestAutomationApi("delete", `/${draft.id}`).expect(200);
    await t.requestAutomationApi("get", `/${draft.id}`).expect(404);
  });

  it("duplicates archived workflows as independent drafts with remapped step identities", async () => {
    const original = await t.createEnabledAutomation();
    await t.requestAutomationApi("post", `/${original.id}/archive`).expect(201);
    const copy = (await t.requestAutomationApi("post", `/${original.id}/duplicate`).expect(201))
      .body.data;
    expect(copy).toMatchObject({
      name: `${original.name} (copy)`,
      status: "draft",
      executionVersion: 0,
      appliedDefinition: null,
    });
    expect(copy.id).not.toBe(original.id);
    const ids = original.workflow.steps.map(({ id }) => id);
    expect(copy.workflow.steps.every((step: { id: string }) => !ids.includes(step.id))).toBe(true);
    await t.requestAutomationApi("post", `/${copy.id}/enable`).expect(201);
    await t.requestAutomationApi("patch", `/${copy.id}`).send({ name: "Independent" }).expect(200);
    expect((await t.getAutomation(original.id)).name).toBe(original.name);
  });

  it.each([
    "duplicate_step_id",
    "missing_parent",
    "self_parent",
    "invalid_root",
    "cross_automation_reference",
    "invalid_successor",
  ])("rejects %s topology without changing the saved workflow", async (code) => {
    const saved = await t.createAutomation();
    const body = createWelcomeAutomationDefinition();
    const action = getFirstEmailStep(body);
    if (code === "duplicate_step_id") body.workflow.steps.push(structuredClone(action));
    if (code === "missing_parent") action.parentId = randomUUID();
    if (code === "self_parent") action.parentId = action.id;
    if (code === "invalid_root") body.workflow.rootStepId = randomUUID();
    if (code === "cross_automation_reference") action.automationId = randomUUID();
    if (code === "invalid_successor")
      body.workflow.steps.push({ ...structuredClone(action), id: randomUUID() });
    const response = await t
      .requestAutomationApi("patch", `/${saved.id}`)
      .send({ workflow: body.workflow })
      .expect(400);
    expect(response.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
    expect(await t.getAutomation(saved.id)).toEqual(saved);
  });

  it.each(BUILT_IN_AUTOMATIONS)(
    "can save, simulate, and enable the $eventKind catalog workflow",
    async ({ templateKey }) => {
      const catalog = (await t.requestAutomationApi("get", "/workflow-templates").expect(200)).body
        .data as AutomationWorkflowTemplateResponse[];
      const body = catalog.find(({ key }) => key === templateKey)!.definition;
      const simulation = (
        await t
          .requestAutomationApi("post", "/simulate")
          .send({ workflow: body.workflow })
          .expect(201)
      ).body.data;
      expect(simulation.issues).toEqual([]);
      expect(simulation.previews.length).toBeGreaterThan(0);
      const automation = await t.createEnabledAutomation(body);
      expect(automation.hasUnappliedChanges).toBe(false);
      expect(t.adapter.getAllEmails()).toEqual([]);
    },
  );

  it("updates localized metadata without replacing other locales and copies translations", async () => {
    const created = await t.createAutomation({
      ...createWelcomeAutomationDefinition(),
      name: "English name",
    });
    await t
      .requestAutomationApi("patch", `/${created.id}?language=pl`)
      .send({ name: "Polska nazwa", description: "Polski opis" })
      .expect(200);
    expect((await t.getAutomation(created.id)).name).toBe("English name");
    expect(
      (await t.requestAutomationApi("get", `/${created.id}?language=pl`).expect(200)).body.data
        .name,
    ).toBe("Polska nazwa");
    expect(
      (await t.requestAutomationApi("get", `/${created.id}?language=de`).expect(200)).body.data
        .name,
    ).toBe("English name");
    const copy = (
      await t.requestAutomationApi("post", `/${created.id}/duplicate?language=pl`).expect(201)
    ).body.data;
    expect(copy.name).toBe("Polska nazwa (copy)");
    expect((await t.getAutomation(copy.id)).name).toBe("English name (copy)");
  });
});
