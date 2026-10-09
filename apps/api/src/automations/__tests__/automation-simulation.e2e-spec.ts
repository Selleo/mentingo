import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { automationRuns } from "src/storage/schema";

import {
  createWelcomeAutomationDefinition,
  getFirstEmailStep,
  setupAutomationTestContext,
} from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";
import type { AutomationWorkflowTemplateResponse } from "../schema/automation.schema";
import type {
  AutomationDefinition,
  AutomationPlaceholderMappings,
  SupportedLanguages,
} from "@repo/shared";

const branchScenarios = [
  {
    event: "user_assigned_to_course",
    sample: { has_deadline: true },
    template: "assignment_with_deadline",
  },
  {
    event: "user_assigned_to_course",
    sample: { has_deadline: false },
    template: "assignment_without_deadline",
  },
  {
    event: "user_finished_course",
    sample: { has_certificate: true },
    template: "completion_with_certificate",
  },
  {
    event: "user_finished_course",
    sample: { has_certificate: false },
    template: "completion_without_certificate",
  },
  {
    event: "certificate_expired",
    sample: { was_manually_reset: true },
    template: "certificate_manually_reset",
  },
  {
    event: "certificate_expired",
    sample: { was_manually_reset: false },
    template: "certificate_naturally_expired",
  },
  {
    event: "user_short_inactivity",
    sample: { has_course: true },
    template: "short_inactivity_course",
  },
  {
    event: "user_short_inactivity",
    sample: { has_course: false },
    template: "short_inactivity_platform",
  },
  {
    event: "user_long_inactivity",
    sample: { has_course: true },
    template: "long_inactivity_course",
  },
  {
    event: "user_long_inactivity",
    sample: { has_course: false },
    template: "long_inactivity_platform",
  },
  {
    event: "course_due_date_reminder",
    sample: { is_due_today: true, is_due_tomorrow: false },
    template: "deadline_today",
  },
  {
    event: "course_due_date_reminder",
    sample: { is_due_today: false, is_due_tomorrow: true },
    template: "deadline_tomorrow",
  },
  {
    event: "course_due_date_reminder",
    sample: { is_due_today: false, is_due_tomorrow: false },
    template: "deadline_upcoming",
  },
];

describe("Automation validation and simulation (e2e)", () => {
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

  const catalog = async () =>
    (await t.requestAutomationApi("get", "/workflow-templates").expect(200)).body
      .data as AutomationWorkflowTemplateResponse[];
  const simulate = async (
    body: AutomationDefinition,
    sampleValues = {},
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) =>
    (
      await t
        .requestAutomationApi("post", "/simulate")
        .send({ workflow: body.workflow, sampleValues, language })
        .expect(201)
    ).body.data;
  const rejectsReadiness = async (body: AutomationDefinition, code: string) => {
    const saved = await t.createAutomation(body);
    const simulation = await simulate(body);
    expect(simulation.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
    expect(simulation.previews).toEqual([]);
    for (const operation of ["apply", "enable"]) {
      const response = await t
        .requestAutomationApi("post", `/${saved.id}/${operation}`)
        .expect(422);
      expect(response.body.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
      expect(await t.getAutomation(saved.id)).toEqual(saved);
    }
  };

  it.each(branchScenarios)(
    "selects $template for $event with $sample",
    async ({ event, sample, template }) => {
      const body = (await catalog()).find(({ definition }) =>
        definition.workflow.steps.some(
          (step) => step.type === "trigger" && step.config.eventKind === event,
        ),
      )!.definition;
      const result = await simulate(body, sample);
      expect(result.issues).toEqual([]);
      expect(result.previews).toHaveLength(1);
      expect(result.previews[0].template).toEqual({ type: "builtin", key: template });
      expect(result.previews[0].html).not.toContain("{{");
      expect(result.steps.filter((step: { type: string }) => step.type === "condition")).toEqual(
        expect.arrayContaining([expect.objectContaining({ matchedCount: 1, failedCount: 0 })]),
      );
      expect(
        await t.runAsTenant(t.defaultTenantId, () => t.db.select().from(automationRuns)),
      ).toEqual([]);
      expect(t.adapter.getAllEmails()).toEqual([]);
    },
  );

  it.each([
    ["missing_mapping", {}],
    ["unknown_event_field", { courses_link: { type: "event_field", field: "nonexistent" } }],
    ["mapping_type_mismatch", { courses_link: { type: "static", value: 42 } }],
    ["mapping_type_mismatch", { courses_link: { type: "static", value: "javascript:alert(1)" } }],
    [
      "unknown_placeholder",
      {
        courses_link: { type: "event_field", field: "courses_link" },
        unknown: { type: "static", value: "x" },
      },
    ],
    [
      "reserved_mapping",
      {
        courses_link: { type: "event_field", field: "courses_link" },
        company_name: { type: "static", value: "Spoofed" },
      },
    ],
  ] as [string, AutomationPlaceholderMappings][])(
    "reports %s for invalid mappings",
    async (code, mappings) => {
      const body = createWelcomeAutomationDefinition();
      getFirstEmailStep(body).config.mappings = mappings;
      await rejectsReadiness(body, code);
    },
  );

  it.each(["user", "group", "role"] as const)("rejects unavailable %s recipients", async (type) => {
    const body = createWelcomeAutomationDefinition();
    const id = randomUUID();
    const selections = {
      user: { type: "user" as const, userId: id },
      group: { type: "group" as const, groupId: id },
      role: { type: "role" as const, roleId: id },
    };
    getFirstEmailStep(body).config.recipients = selections[type];
    await rejectsReadiness(body, "unavailable_recipients");
  });

  it("rejects a real recipient belonging to another tenant", async () => {
    const body = createWelcomeAutomationDefinition();
    getFirstEmailStep(body).config.recipients = { type: "user", userId: t.otherAdmin.id };
    await rejectsReadiness(body, "unavailable_recipients");
  });

  it.each(["everyone", "user"] as const)(
    "prevents account action links being sent to %s",
    async (type) => {
      const body = (await catalog()).find(({ key }) => key === "password_recovery")!.definition;
      getFirstEmailStep(body).config.recipients =
        type === "everyone" ? { type } : { type, userId: t.student.id };
      await rejectsReadiness(body, "unsafe_account_action_recipients");
    },
  );

  it("requires account-action mappings even when an unrelated template is selected", async () => {
    const body = createWelcomeAutomationDefinition();
    const trigger = body.workflow.steps[0];
    if (trigger.type === "trigger") trigger.config.eventKind = "password_recovery";
    getFirstEmailStep(body).config.mappings = {
      courses_link: { type: "static", value: "https://academy.example" },
    };
    await rejectsReadiness(body, "missing_account_action");
  });

  it("rejects missing, draft, and foreign templates and lists only published tenant templates", async () => {
    const custom = await t.createEmailTemplate();
    const body = createWelcomeAutomationDefinition();
    getFirstEmailStep(body).config.template = { type: "custom", id: custom.id! };
    await rejectsReadiness(body, "unavailable_template");
    await t.requestEmailTemplateApi("post", `/${custom.id}/publish`).expect(201);
    expect((await simulate(body)).issues).toEqual([]);
    const options = (await t.requestAutomationApi("get", "/templates").expect(200)).body.data;
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: { type: "custom", id: custom.id } }),
      ]),
    );
    expect(
      (
        await t
          .requestAutomationApi("get", "/templates", t.otherCookie, t.otherTenant.host)
          .expect(200)
      ).body.data,
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: { type: "custom", id: custom.id } }),
      ]),
    );
    const foreign = (
      await t
        .requestAutomationApi("post", "/simulate", t.otherCookie, t.otherTenant.host)
        .send({ workflow: body.workflow })
        .expect(201)
    ).body.data;
    expect(foreign.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unavailable_template" })]),
    );
    getFirstEmailStep(body).config.template = { type: "custom", id: randomUUID() };
    await rejectsReadiness(body, "unavailable_template");
  });

  it("rejects branch-only fields outside their guaranteed branch", async () => {
    const body = (await catalog()).find(({ definition }) =>
      definition.workflow.steps.some(
        (step) => step.type === "trigger" && step.config.eventKind === "user_assigned_to_course",
      ),
    )!.definition;
    const action = body.workflow.steps.find(
      (step) =>
        step.type === "send_email" &&
        step.config.template?.type === "builtin" &&
        step.config.template.key === "assignment_with_deadline",
    )!;
    action.parentId = body.workflow.rootStepId;
    action.position = 0;
    body.workflow.steps = [body.workflow.steps[0], action];
    await rejectsReadiness(body, "field_unavailable_on_branch");
  });

  it.each([{ unknown: true }, { courses_link: 1 }, { courses_link: "javascript:alert(1)" }])(
    "rejects invalid sample values %#",
    async (sample) => {
      expect((await simulate(createWelcomeAutomationDefinition(), sample)).issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "invalid_sample" })]),
      );
    },
  );

  it("keeps preview text synthetic and honors requested language without delivering mail", async () => {
    const result = await simulate(
      createWelcomeAutomationDefinition(),
      { courses_link: "https://private.example/secret" },
      SUPPORTED_LANGUAGES.PL,
    );
    expect(result.issues).toEqual([]);
    expect(result.previews[0].language).toBe(SUPPORTED_LANGUAGES.PL);
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(t.adapter.getAllEmails()).toEqual([]);
  });

  it("does not allow simulation to attach to another tenant's saved automation", async () => {
    const saved = await t.createAutomation();
    await t
      .requestAutomationApi("post", "/simulate", t.otherCookie, t.otherTenant.host)
      .send({ automationId: saved.id, workflow: saved.workflow })
      .expect(404);
  });
});
