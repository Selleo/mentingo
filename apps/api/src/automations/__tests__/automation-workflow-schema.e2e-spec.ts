import { randomUUID } from "node:crypto";

import { automationRuns, automations, automationSteps } from "src/storage/schema";

import {
  createWelcomeAutomationDefinition,
  getFirstEmailStep,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";
import type {
  AutomationDefinition,
  AutomationPlaceholderValue,
  AutomationStep,
} from "@repo/shared";

const workflowWithEmailStep = (overrides: Record<string, unknown>) => {
  const { workflow } = createWelcomeAutomationDefinition();
  return { ...workflow, steps: [workflow.steps[0], { ...workflow.steps[1], ...overrides }] };
};
const workflowWithEmailConfig = (overrides: Record<string, unknown>) => {
  const definition = createWelcomeAutomationDefinition();
  return workflowWithEmailStep({
    config: { ...getFirstEmailStep(definition).config, ...overrides },
  });
};
const createLinearWorkflow = (stepCount: number) => {
  const definition = createWelcomeAutomationDefinition();
  const trigger = definition.workflow.steps[0];
  const email = getFirstEmailStep(definition);
  const steps: AutomationStep[] = [trigger];
  for (let index = 1; index < stepCount; index++) {
    steps.push({ ...structuredClone(email), id: randomUUID(), parentId: steps[index - 1].id });
  }
  return { rootStepId: trigger.id, steps };
};

const invalidWorkflows = [
  { name: "missing workflow", build: () => undefined },
  { name: "null workflow", build: () => null },
  { name: "array workflow", build: () => [] },
  { name: "missing rootStepId", build: () => ({ steps: [] }) },
  { name: "non-UUID rootStepId", build: () => ({ rootStepId: "bad-id", steps: [] }) },
  { name: "missing steps", build: () => ({ rootStepId: null }) },
  { name: "null steps", build: () => ({ rootStepId: null, steps: null }) },
  { name: "non-array steps", build: () => ({ rootStepId: null, steps: {} }) },
  {
    name: "unknown workflow property",
    build: () => ({ ...createWelcomeAutomationDefinition().workflow, enabled: true }),
  },
  { name: "null step", build: () => ({ rootStepId: null, steps: [null] }) },
  ...["id", "parentId", "position", "type", "config"].map((key) => ({
    name: `missing step ${key}`,
    build: () => workflowWithEmailStep({ [key]: undefined }),
  })),
  ...["id", "parentId", "automationId"].map((key) => ({
    name: `non-UUID step ${key}`,
    build: () => workflowWithEmailStep({ [key]: "bad-id" }),
  })),
  ...[-1, 0.5, "0", null].map((position) => ({
    name: `invalid position ${JSON.stringify(position)}`,
    build: () => workflowWithEmailStep({ position }),
  })),
  { name: "unknown step type", build: () => workflowWithEmailStep({ type: "wait" }) },
  { name: "unknown step property", build: () => workflowWithEmailStep({ enabled: true }) },
  { name: "null config", build: () => workflowWithEmailStep({ config: null }) },
  { name: "array config", build: () => workflowWithEmailStep({ config: [] }) },
  {
    name: "trigger fields on email config",
    build: () => workflowWithEmailConfig({ eventKind: "welcome" }),
  },
  {
    name: "unknown trigger event",
    build: () => {
      const { workflow } = createWelcomeAutomationDefinition();
      return {
        ...workflow,
        steps: [{ ...workflow.steps[0], config: { eventKind: "unknown" } }, workflow.steps[1]],
      };
    },
  },
  {
    name: "email fields on trigger config",
    build: () => {
      const { workflow } = createWelcomeAutomationDefinition();
      return {
        ...workflow,
        steps: [
          { ...workflow.steps[0], config: { eventKind: "welcome", template: null } },
          workflow.steps[1],
        ],
      };
    },
  },
  ...["", "x".repeat(201), 1, null].map((field, index) => ({
    name: `invalid condition field ${index}`,
    build: () => workflowWithEmailStep({ type: "condition", config: { field } }),
  })),
  {
    name: "unknown condition config property",
    build: () =>
      workflowWithEmailStep({
        type: "condition",
        config: { field: "has_deadline", operator: "equals" },
      }),
  },
  ...[
    { type: "builtin", key: "unknown" },
    { type: "builtin" },
    { type: "builtin", key: "welcome", id: randomUUID() },
    { type: "custom" },
    { type: "custom", id: "bad-id" },
    { type: "custom", id: randomUUID(), key: "welcome" },
    { type: "external", id: randomUUID() },
  ].map((template, index) => ({
    name: `invalid template reference ${index}`,
    build: () => workflowWithEmailConfig({ template }),
  })),
  ...[
    { type: "event_field" },
    { type: "event_field", field: "" },
    { type: "event_field", field: 1 },
    { type: "event_field", field: "courses_link", value: "extra" },
    { type: "static" },
    { type: "static", value: "value", field: "extra" },
    { type: "expression", value: "value" },
    null,
  ].map((mapping, index) => ({
    name: `invalid placeholder mapping ${index}`,
    build: () => workflowWithEmailConfig({ mappings: { courses_link: mapping } }),
  })),
  { name: "array mappings", build: () => workflowWithEmailConfig({ mappings: [] }) },
  ...[
    { type: "event", userId: randomUUID() },
    { type: "everyone", groupId: randomUUID() },
    { type: "user" },
    { type: "user", userId: "bad-id" },
    { type: "group", userId: randomUUID() },
    { type: "role", roleId: "bad-id" },
    { type: "user", userId: randomUUID(), roleId: randomUUID() },
    { type: "email", email: "learner@example.com" },
    null,
    [],
  ].map((recipients, index) => ({
    name: `invalid recipient selection ${index}`,
    build: () => workflowWithEmailConfig({ recipients }),
  })),
  { name: "101 steps exceeding the maximum", build: () => createLinearWorkflow(101) },
];

describe("Automation workflow request schema (e2e)", () => {
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

  const snapshotAutomationState = () =>
    t.runAsTenant(t.defaultTenantId, async () => ({
      automations: await t.db.select().from(automations).orderBy(automations.id),
      steps: await t.db
        .select()
        .from(automationSteps)
        .orderBy(automationSteps.automationId, automationSteps.definitionKind, automationSteps.id),
      runs: await t.db.select().from(automationRuns),
    }));

  it.each(invalidWorkflows)(
    "rejects $name through POST create, PATCH, POST apply, and POST simulate",
    async ({ build }) => {
      const saved = await t.createEnabledAutomation();
      const before = await snapshotAutomationState();
      const workflow = build();
      const definition = { ...createWelcomeAutomationDefinition(), workflow };
      await t.requestAutomationApi("post").send(definition).expect(400);
      await t.requestAutomationApi("patch", `/${saved.id}`).send({ workflow }).expect(400);
      await t.requestAutomationApi("post", `/${saved.id}/apply`).send({ definition }).expect(400);
      await t.requestAutomationApi("post", "/simulate").send({ workflow }).expect(400);
      expect(await t.getAutomation(saved.id)).toEqual(saved);
      expect(await snapshotAutomationState()).toEqual(before);
      expect(await t.queue.getWaitingCount()).toBe(0);
      expect(t.adapter.getAllEmails()).toEqual([]);
    },
  );

  it("accepts exactly 100 connected steps and rejects an oversized update atomically", async () => {
    const definition = {
      ...createWelcomeAutomationDefinition(),
      workflow: createLinearWorkflow(100),
    };
    const created = await t.createEnabledAutomation(definition);
    expect(created.workflow.steps).toHaveLength(100);
    expect(created.appliedDefinition?.workflow.steps).toHaveLength(100);
    await t
      .requestAutomationApi("patch", `/${created.id}`)
      .send({ workflow: createLinearWorkflow(101) })
      .expect(400);
    expect(await t.getAutomation(created.id)).toEqual(created);
  });

  it.each(["omitted", "null"])(
    "allows %s trigger/template choices in a draft but blocks activation",
    async (mode) => {
      const definition = createWelcomeAutomationDefinition();
      const trigger = definition.workflow.steps[0];
      if (trigger.type === "trigger") trigger.config = mode === "null" ? { eventKind: null } : {};
      getFirstEmailStep(definition).config = mode === "null" ? { template: null } : {};
      const created = await t.createAutomation(definition);
      expect(created.workflow).toEqual({
        ...definition.workflow,
        steps: expect.arrayContaining([
          { ...trigger, config: { eventKind: null } },
          getFirstEmailStep(definition),
        ]),
      });
      expect(created.workflow.steps).toHaveLength(2);
      await t.requestAutomationApi("post", `/${created.id}/enable`).expect(422);
      expect(await t.getAutomation(created.id)).toEqual(created);
      const simulation = (
        await t
          .requestAutomationApi("post", "/simulate")
          .send({ workflow: definition.workflow })
          .expect(201)
      ).body.data;
      expect(simulation.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "missing_event" }),
          expect.objectContaining({ code: "missing_template" }),
        ]),
      );
      expect(simulation.previews).toEqual([]);
    },
  );

  it.each([
    { label: "empty string", value: "" },
    { label: "zero", value: 0 },
    { label: "false", value: false },
    { label: "null", value: null },
    { label: "nested array", value: ["text", 0, false, null, { nested: [1] }] },
    { label: "nested object", value: { nested: { items: [1, true, null] } } },
  ] satisfies { label: string; value: AutomationPlaceholderValue }[])(
    "preserves a $label static value in a draft",
    async ({ value }) => {
      const definition = createWelcomeAutomationDefinition();
      getFirstEmailStep(definition).config.mappings = { courses_link: { type: "static", value } };
      const created = await t.createAutomation(definition);
      expect(getFirstEmailStep(await t.getAutomation(created.id)).config.mappings).toEqual({
        courses_link: { type: "static", value },
      });
    },
  );

  it("accepts maximum metadata lengths and preserves them when applying", async () => {
    const definition: AutomationDefinition = {
      ...createWelcomeAutomationDefinition(),
      name: "n".repeat(200),
      description: "d".repeat(5000),
    };
    const created = await t.createEnabledAutomation(definition);
    expect(created.name).toBe(definition.name);
    expect(created.description).toBe(definition.description);
    expect(created.appliedDefinition).toEqual({
      ...definition,
      workflow: {
        ...definition.workflow,
        steps: expect.arrayContaining(definition.workflow.steps),
      },
    });
    expect(created.appliedDefinition?.workflow.steps).toHaveLength(
      definition.workflow.steps.length,
    );
  });
});
