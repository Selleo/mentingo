import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CompetencySubject } from "./CompetencySubject";

import type { CompetenciesWorkspace } from "../competencies.types";

vi.mock("~/api/mutations/useDownloadCompetenciesAttachment", () => ({
  useDownloadCompetenciesAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const executeCompetenciesCommand = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("~/api/mutations/useExecuteCompetenciesCommand", () => ({
  useExecuteCompetenciesCommand: () => ({
    mutateAsync: executeCompetenciesCommand,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/useUploadCompetenciesAttachment", () => ({
  useUploadCompetenciesAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function fixture() {
  const observation = {
    id: "practice",
    kind: "observation",
    description: "Change the format safely",
  };
  const catalog = [
    {
      id: "packing",
      name: "Format change",
      levels: [
        { id: "first", name: "Foundation", conditions: [] },
        { id: "second", name: "Independent", conditions: [observation] },
      ],
    },
    {
      id: "quality",
      name: "Quality control",
      levels: [
        { id: "first", name: "Foundation", conditions: [] },
        { id: "second", name: "Independent", conditions: [] },
        { id: "third", name: "Expert", conditions: [] },
      ],
    },
    {
      id: "safety",
      name: "Machine safety",
      levels: [{ id: "first", name: "Foundation", conditions: [] }],
    },
  ].map((item) => ({ ...item, category: "Production", description: item.name, archived: false }));
  const standings = [
    {
      competencyId: "packing",
      currentLevelId: "first",
      attainedLevelId: "first",
      expiring: false,
      effectiveUntil: null,
      levels: [
        { levelId: "first", met: true, conditions: [] },
        {
          levelId: "second",
          met: false,
          conditions: [
            {
              conditionId: "practice",
              met: false,
              evidenceIds: ["observation"],
              effectiveFrom: null,
            },
          ],
        },
      ],
    },
    {
      competencyId: "quality",
      currentLevelId: "third",
      attainedLevelId: "third",
      expiring: true,
      effectiveUntil: "2026-11-10T12:00:00Z",
      levels: [],
    },
    {
      competencyId: "safety",
      currentLevelId: "first",
      attainedLevelId: "first",
      expiring: false,
      effectiveUntil: null,
      levels: [],
    },
  ].map((standing) => ({ subjectId: "emma", standing: { effectiveFrom: null, ...standing } }));
  return {
    catalog,
    standings,
    assessments: [
      {
        subjectId: "emma",
        profileId: "operator",
        coverage: 67,
        metCount: 2,
        requirementCount: 3,
        requirements: standings.map(({ standing }, index) => ({
          standing,
          met: index > 0,
          requirement: {
            competencyId: standing.competencyId,
            levelId: ["second", "third", "first"][index],
          },
        })),
      },
    ],
    people: [
      { id: "emma", name: "Emma Example" },
      { id: "manager", name: "Morgan Example" },
    ],
    actions: [
      {
        id: "next",
        subjectId: "emma",
        competencyId: "packing",
        levelId: "second",
        status: "planned",
        kind: "practice",
        ownerId: "manager",
        objective: "Practice changing the format",
        dueDate: "2026-10-24T12:00:00Z",
      },
      {
        id: "cancelled",
        subjectId: "emma",
        competencyId: "packing",
        status: "cancelled",
        kind: "practice",
        ownerId: "manager",
        objective: "Cancelled practice",
        dueDate: "2026-10-01T12:00:00Z",
      },
    ],
    evidence: [
      {
        id: "observation",
        subjectId: "emma",
        competencyId: "packing",
        conditionIds: ["practice"],
        kind: "observation",
        status: "approved",
        occurredAt: "2026-10-19T12:00:00Z",
        note: "Observed format change",
      },
    ],
    awardHistory: [],
    revocations: [],
    verifiers: {},
    conditionOverrides: [],
    asOf: "2026-10-20T12:00:00Z",
  } as unknown as CompetenciesWorkspace;
}

describe("employee competency overview", () => {
  it("uses neutral next-step wording when inspecting another employee", () => {
    renderWith().render(
      <CompetencySubject
        workspace={fixture()}
        subjectId="emma"
        userId="manager"
        onPlan={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Next step: Practice changing the format" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: /Your next step/ })).not.toBeInTheDocument();
  });
  it("matches the reference information layout using real levels, evidence and expiry", () => {
    renderWith().render(
      <CompetencySubject workspace={fixture()} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    expect(screen.getByText("2 of 3 met")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getAllByText("Action Required")[0]).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Your next step: Practice changing the format" }),
    ).toBeVisible();
    expect(screen.queryByText("Cancelled practice")).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Competencies" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((head) => head.textContent),
    ).toEqual(["Competency", "Your / Required", "Latest evidence", "What next"]);
    const packing = within(table).getByRole("row", { name: /Format change/ });
    expect(packing).toHaveTextContent("L1 / L2");
    expect(packing).toHaveTextContent("Observation: Approved");
    expect(packing).toHaveTextContent("Practice");
    const quality = within(table).getByRole("row", { name: /Quality control/ });
    expect(quality).toHaveTextContent("L3 / L3");
    expect(quality).toHaveTextContent("Expiring in 21 Days");
    expect(quality).toHaveTextContent("Renewal");
    expect(within(table).queryByText("Machine safety")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirmed" })).toBeVisible();
    expect(screen.getByText("2 competencies")).toBeVisible();
    expect(screen.getByText("1 competency")).toBeVisible();
    expect(
      within(screen.getByRole("complementary")).getByText("Valid for 21 more days"),
    ).toBeVisible();
  });
  it("keeps action labels static and opens the plan only from its explicit button", async () => {
    const onPlan = vi.fn();
    renderWith().render(
      <CompetencySubject workspace={fixture()} subjectId="emma" userId="emma" onPlan={onPlan} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(onPlan).toHaveBeenCalledOnce();
    const row = screen.getByRole("row", { name: /Format change/ });
    expect(within(row).getByRole("button", { name: "View details: Format change" })).toBeVisible();
    await userEvent.click(within(row).getByRole("button", { name: "View details: Format change" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(row).getByText("Practice", { exact: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View details: Machine safety" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Machine safety");
    expect(
      within(screen.getByRole("dialog")).getByText("Foundation", { selector: "dd" }),
    ).toBeVisible();
  });
  it("opens an expiring competency only from its explicit details button", async () => {
    renderWith().render(
      <CompetencySubject workspace={fixture()} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    const aside = within(screen.getByRole("complementary"));
    const name = aside.getByText("Quality control", { exact: true });
    expect(name.closest("button, a")).toBeNull();
    await userEvent.click(name);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const button = aside.getByRole("button", { name: "View details: Quality control" });
    expect(button).toHaveTextContent("View details");
    await userEvent.click(button);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Quality control");
  });
  it("identifies expiring conditions and their dates in summaries and the person dialog", async () => {
    const value = fixture();
    value.warningDays = 30;
    const definition = value.catalog[1];
    definition.levels[0].conditions = [
      { id: "inspection", kind: "observation", description: "Refresh the inspection checklist" },
    ];
    definition.levels[1].conditions = [
      { id: "portfolio", kind: "document", description: "Keep the quality portfolio" },
    ];
    definition.levels[2].conditions = [
      { id: "audit", kind: "quiz", description: "Pass the independent audit" },
    ];
    const results = [
      { conditionId: "inspection", effectiveUntil: "2026-10-25T12:00:00Z" },
      { conditionId: "portfolio", effectiveUntil: null },
      { conditionId: "audit", effectiveUntil: "2026-10-27T12:00:00Z" },
    ].map((item) => ({
      ...item,
      met: true,
      reason: null,
      evidenceIds: ["selected-proof"],
      effectiveFrom: "2026-10-01T12:00:00Z",
    }));
    const standing = value.standings[1].standing;
    standing.effectiveUntil = results[0].effectiveUntil;
    standing.levels = definition.levels.map((level, index) => ({
      levelId: level.id,
      met: true,
      conditions: results.slice(0, index + 1),
    }));
    renderWith().render(
      <CompetencySubject workspace={value} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    const summaries = screen.getAllByRole("list", { name: "Expiring soon: Quality control" });
    expect(summaries).toHaveLength(2);
    for (const summary of summaries) {
      expect(
        within(summary).getByText(/Level 1 - Observation: Refresh the inspection checklist/),
      ).toBeVisible();
      expect(within(summary).getByText(/Valid until 25 Oct 2026/)).toBeVisible();
      expect(within(summary).getByText(/Level 3 - Quiz: Pass the independent audit/)).toBeVisible();
      expect(within(summary).getByText(/Valid until 27 Oct 2026/)).toBeVisible();
      expect(within(summary).queryByText(/Keep the quality portfolio/)).not.toBeInTheDocument();
    }
    await userEvent.click(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: "View details: Quality control",
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    const inspection = dialog.getByText("Refresh the inspection checklist").closest("li")!;
    expect(within(inspection).getByText("Expiring soon")).toBeVisible();
    expect(within(inspection).getByText(/Valid until 25 Oct 2026/)).toBeVisible();
    expect(within(inspection).queryByText("Met")).not.toBeInTheDocument();
    const portfolio = dialog.getByText("Keep the quality portfolio").closest("li")!;
    expect(within(portfolio).getByText("Met")).toBeVisible();
    expect(within(portfolio).queryByText("Expiring soon")).not.toBeInTheDocument();
  });
  it("hides evidence history in the employee details while retaining it for inspection", async () => {
    const value = fixture();
    const { rerender } = renderWith().render(
      <CompetencySubject workspace={value} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details: Format change" }));
    expect(
      within(screen.getByRole("dialog")).queryByText("Evidence history"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Observed format change")).not.toBeInTheDocument();
    rerender(
      <CompetencySubject workspace={value} subjectId="emma" userId="manager" onPlan={vi.fn()} />,
    );
    expect(within(screen.getByRole("dialog")).getByText("Evidence history")).toBeVisible();
    expect(screen.getByText("Observed format change")).toBeVisible();
  });
  it("does not claim readiness when any requirements are missing", () => {
    const workspace = fixture();
    workspace.actions = [];
    workspace.evidence = [];
    workspace.standings[0].standing.levels[1].conditions[0].evidenceIds = [];
    renderWith().render(
      <CompetencySubject workspace={workspace} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    expect(
      screen.getByText(
        "Some requirements still need confirmation. Review the gaps and your development plan.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("row", { name: /Format change/ })).toHaveTextContent(
      "Missing evidence",
    );
    expect(screen.getByRole("row", { name: /Format change/ })).toHaveTextContent("Gap");
    expect(
      screen.getByRole("heading", { name: "Your next step: Change the format safely" }),
    ).toBeVisible();
    expect(screen.getByText("Awaiting confirmation by the responsible person.")).toBeVisible();
  });
  it("shows only actual requirements as gaps and keeps all empty summary sections visible", async () => {
    const workspace = fixture();
    workspace.assessments[0].requirements = [workspace.assessments[0].requirements[0]];
    workspace.assessments[0].metCount = 0;
    workspace.assessments[0].requirementCount = 1;
    workspace.actions = [];
    for (const item of workspace.standings.slice(1)) {
      item.standing.currentLevelId = null;
      item.standing.expiring = false;
    }
    workspace.awardHistory = [
      {
        subjectId: "emma",
        competencyId: "safety",
        standing: workspace.standings[2].standing,
        ruleRevision: 1,
        recordedAt: workspace.asOf,
      },
    ];
    const onPlan = vi.fn();
    renderWith().render(
      <CompetencySubject workspace={workspace} subjectId="emma" userId="emma" onPlan={onPlan} />,
    );
    const table = screen.getByRole("table", { name: "Competencies" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("row", { name: /Format change/ })).toHaveTextContent("L1 / L2");
    expect(within(table).queryByText("Quality control")).not.toBeInTheDocument();
    expect(within(table).queryByText("Machine safety")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirmed" })).toBeVisible();
    expect(screen.getByText("0 competencies")).toBeVisible();
    expect(
      screen.getByText("No competencies have been confirmed at the required level yet."),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Expiring soon" })).toBeVisible();
    expect(screen.getByText("No competency confirmations are expiring soon.")).toBeVisible();
    expect(screen.queryByText("Achievement history")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(onPlan).toHaveBeenCalledOnce();
  });
  it("does not create gaps from the catalog when no profile is assigned", () => {
    const workspace = fixture();
    workspace.assessments[0].profileId = null;
    workspace.assessments[0].coverage = null;
    workspace.assessments[0].requirements = [];
    workspace.actions = [];
    renderWith().render(
      <CompetencySubject workspace={workspace} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getAllByText("No assigned profile")).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Your next step" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Confirmed" })).toBeVisible();
  });
  it("names the completed course and points to the remaining required confirmation", () => {
    const workspace = fixture();
    workspace.actions = [];
    workspace.evidence = [];
    workspace.catalog[0].levels[1].conditions.push({
      id: "theory",
      kind: "course",
      description: "Complete Communication theory",
      resourceId: "theory-course",
    });
    workspace.standings[0].standing.levels[1].conditions[0].evidenceIds = [];
    workspace.standings[0].standing.levels[1].conditions.push({
      conditionId: "theory",
      met: true,
      reason: null,
      effectiveFrom: workspace.asOf,
      effectiveUntil: null,
      evidenceIds: [],
    });
    renderWith().render(
      <CompetencySubject workspace={workspace} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    expect(screen.getByRole("row", { name: /Format change/ })).toHaveTextContent(
      "Complete Communication theory: Completed",
    );
    expect(
      screen.getByRole("heading", { name: "Your next step: Change the format safely" }),
    ).toBeVisible();
    expect(screen.getByText("Awaiting confirmation by the responsible person.")).toBeVisible();
  });

  it("lets a designated verifier confirm another employee observation", async () => {
    const workspace = fixture();
    workspace.catalog[2].levels[0].conditions = [
      {
        id: "safety-practice",
        kind: "observation",
        description: "Inspect the machine",
        verifierIds: ["manager"],
      },
    ];
    workspace.standings[2].standing.levels = [
      {
        levelId: "first",
        met: true,
        conditions: [
          {
            conditionId: "safety-practice",
            met: true,
            reason: null,
            evidenceIds: [],
            effectiveFrom: null,
            effectiveUntil: null,
          },
        ],
      },
    ];
    renderWith().render(
      <CompetencySubject
        workspace={workspace}
        subjectId="emma"
        userId="manager"
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details: Machine safety" }));
    const details = screen.getByRole("dialog");
    await userEvent.click(within(details).getByRole("button", { name: "Confirm observation" }));
    const form = screen.getByRole("dialog");
    expect(
      within(form).queryByRole("combobox", { name: "Condition type" }),
    ).not.toBeInTheDocument();
    await userEvent.type(within(form).getByLabelText("Note"), "Observed independently");
    await userEvent.click(within(form).getByRole("button", { name: "Submit" }));
    expect(executeCompetenciesCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "submit_evidence",
        value: expect.objectContaining({
          subjectId: "emma",
          competencyId: "safety",
          conditionIds: ["safety-practice"],
          kind: "observation",
          note: "Observed independently",
        }),
      }),
    );
  });

  it("lets a verifier discover an observation without a visible employee job profile or pending submission", async () => {
    const workspace = fixture();
    workspace.assessments = [];
    workspace.catalog[0].levels[1].conditions[0].verifierIds = ["verifier"];
    renderWith().render(
      <CompetencySubject
        workspace={workspace}
        subjectId="emma"
        userId="verifier"
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Inspect competency" }));
    await userEvent.click(screen.getByRole("option", { name: "Format change" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm observation" }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("dialog")).queryByText("Override condition"),
    ).not.toBeInTheDocument();
  });

  it("opens missing competencies from Attention for evidence and admin evaluation", async () => {
    const workspace = fixture();
    workspace.catalog[2].revision = 4;
    workspace.catalog[2].levels[0].conditions = [
      { id: "safety-practice", kind: "observation", description: "Inspect the machine" },
    ];
    workspace.standings[2].standing.currentLevelId = null;
    workspace.standings[2].standing.levels = [
      {
        levelId: "first",
        met: false,
        conditions: [
          {
            conditionId: "safety-practice",
            met: false,
            reason: null,
            evidenceIds: [],
            effectiveFrom: null,
            effectiveUntil: null,
          },
        ],
      },
    ];
    const employeeView = renderWith().render(
      <CompetencySubject workspace={workspace} subjectId="emma" userId="emma" onPlan={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details: Machine safety" }));
    const employeeDetails = screen.getByRole("dialog");
    expect(
      within(employeeDetails).queryByRole("button", { name: "Confirm observation" }),
    ).not.toBeInTheDocument();
    expect(
      within(employeeDetails).getByRole("heading", { name: "Requirements by level" }),
    ).toBeVisible();
    employeeView.unmount();

    renderWith().render(
      <CompetencySubject
        workspace={workspace}
        subjectId="emma"
        userId="admin"
        canManage
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details: Machine safety" }));
    const adminDetails = screen.getByRole("dialog");
    await userEvent.click(within(adminDetails).getByText("Override condition", { exact: true }));
    await userEvent.click(within(adminDetails).getByRole("combobox", { name: "Evaluation" }));
    await userEvent.click(screen.getByRole("option", { name: "Met" }));
    await userEvent.type(within(adminDetails).getByLabelText("Comment"), "Confirmed in review");
    await userEvent.click(within(adminDetails).getByRole("button", { name: "Save evaluation" }));
    expect(executeCompetenciesCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "set_condition_override",
        subjectId: "emma",
        competencyId: "safety",
        revision: 4,
        conditionId: "safety-practice",
        status: "met",
        comment: "Confirmed in review",
      }),
    );
  });

  it("lets admins inspect an unassigned competency while managers stay read-only", async () => {
    const workspace = fixture();
    workspace.assessments[0].profileId = null;
    workspace.people[0].canPlan = true;
    workspace.catalog[2].levels[0].conditions = [
      { id: "safety-practice", kind: "observation", description: "Inspect the machine" },
    ];
    workspace.standings[2].standing.currentLevelId = null;
    workspace.standings[2].standing.levels = [
      {
        levelId: "first",
        met: false,
        conditions: [
          {
            conditionId: "safety-practice",
            met: false,
            reason: null,
            evidenceIds: [],
            effectiveFrom: null,
            effectiveUntil: null,
          },
        ],
      },
    ];
    const adminView = renderWith().render(
      <CompetencySubject
        workspace={workspace}
        subjectId="emma"
        userId="admin"
        canManage
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Inspect competency" }));
    await userEvent.click(screen.getByRole("option", { name: "Machine safety" }));
    const adminDetails = screen.getByRole("dialog");
    expect(within(adminDetails).getByText("Override condition", { exact: true })).toBeVisible();
    adminView.unmount();

    renderWith().render(
      <CompetencySubject
        workspace={workspace}
        subjectId="emma"
        userId="manager"
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Inspect competency" }));
    await userEvent.click(screen.getByRole("option", { name: "Machine safety" }));
    const managerDetails = screen.getByRole("dialog");
    expect(
      within(managerDetails).queryByText("Override condition", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("requires an admin comment and only offers met or automatic overrides", async () => {
    const workspace = fixture();
    workspace.catalog[2].revision = 4;
    workspace.catalog[2].levels[0].conditions = [
      { id: "safety-practice", kind: "observation", description: "Inspect the machine" },
    ];
    renderWith().render(
      <CompetencySubject
        workspace={workspace}
        subjectId="emma"
        userId="admin"
        canManage
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details: Machine safety" }));
    const details = screen.getByRole("dialog");
    await userEvent.click(within(details).getByText("Override condition", { exact: true }));
    const status = within(details).getByRole("combobox", { name: "Evaluation" });
    await userEvent.click(status);
    expect(screen.getByRole("option", { name: "Automatic" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Met" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Not met" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    const save = within(details).getByRole("button", { name: "Save evaluation" });
    expect(save).toBeDisabled();
    await userEvent.type(within(details).getByLabelText("Comment"), "Confirmed in review");
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(executeCompetenciesCommand).toHaveBeenCalledWith({
      operation: "set_condition_override",
      requestId: expect.any(String),
      subjectId: "emma",
      competencyId: "safety",
      revision: 4,
      conditionId: "safety-practice",
      status: "automatic",
      comment: "Confirmed in review",
    });
  });

  it("uses the current override and resets its draft after a definition revision", async () => {
    const workspace = fixture();
    workspace.catalog[2].revision = 4;
    workspace.catalog[2].levels[0].conditions = [
      { id: "safety-practice", kind: "observation", description: "Inspect the machine" },
    ];
    workspace.conditionOverrides = [
      {
        id: "older",
        requestId: "request-older",
        subjectId: "emma",
        competencyId: "safety",
        conditionId: "safety-practice",
        conditionRevision: "old",
        status: "automatic",
        comment: "Older decision",
        createdAt: "2026-10-20T12:00:00Z",
        createdBy: "manager",
        isCurrent: false,
      },
      {
        id: "current",
        requestId: "request-current",
        subjectId: "emma",
        competencyId: "safety",
        conditionId: "safety-practice",
        conditionRevision: "current",
        status: "met",
        comment: "Current decision",
        createdAt: "2026-10-20T12:00:00Z",
        createdBy: "manager",
        isCurrent: true,
      },
    ];
    const view = renderWith().render(
      <CompetencySubject
        workspace={workspace}
        subjectId="emma"
        userId="admin"
        canManage
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details: Machine safety" }));
    const details = screen.getByRole("dialog");
    await userEvent.click(within(details).getByText("Override condition", { exact: true }));
    expect(within(details).getByRole("combobox", { name: "Evaluation" })).toHaveTextContent("Met");
    expect(within(details).getByLabelText("Comment")).toHaveValue("Current decision");
    await userEvent.clear(within(details).getByLabelText("Comment"));
    await userEvent.type(within(details).getByLabelText("Comment"), "Unsaved draft");
    const updated = structuredClone(workspace);
    updated.catalog[2].revision = 5;
    updated.conditionOverrides[1].isCurrent = false;
    view.rerender(
      <CompetencySubject
        workspace={updated}
        subjectId="emma"
        userId="admin"
        canManage
        onPlan={vi.fn()}
      />,
    );
    expect(within(details).getByRole("combobox", { name: "Evaluation" })).toHaveTextContent(
      "Automatic",
    );
    expect(within(details).getByLabelText("Comment")).toHaveValue("");
  });

  it("keeps condition override controls hidden for managers", async () => {
    renderWith().render(
      <CompetencySubject
        workspace={fixture()}
        subjectId="emma"
        userId="manager"
        onPlan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View details: Machine safety" }));
    expect(screen.queryByText("Override condition", { exact: true })).not.toBeInTheDocument();
  });
});
