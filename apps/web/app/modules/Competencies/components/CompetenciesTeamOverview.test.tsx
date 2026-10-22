import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CompetenciesTeamOverview } from "./CompetenciesTeamOverview";

import type { CompetenciesWorkspace } from "../competencies.types";

describe("CompetenciesTeamOverview", () => {
  const workspace = {
    asOf: "2026-10-20T10:00:00Z",
    warningDays: null,
    catalog: [],
    profiles: [],
    publishedProfiles: [],
    subjects: [],
    verifiers: {},
    evidence: [],
    evidenceHistory: [],
    standings: [],
    actions: [],
    actionHistory: [],
    revocations: [],
    awardHistory: [],
    courses: [],
    learningResources: [],
    people: [
      { id: "employee", name: "In-scope employee", archived: false, canPlan: true },
      { id: "other", name: "Other employee", archived: false, canPlan: false },
    ],
    assessments: [
      {
        subjectId: "employee",
        profileId: null,
        profileRevision: null,
        asOf: "2026-10-20T10:00:00Z",
        coverage: null,
        metCount: 0,
        requirementCount: 0,
        requirements: [],
      },
      {
        subjectId: "other",
        profileId: "profile",
        profileRevision: 1,
        asOf: "2026-10-20T10:00:00Z",
        coverage: 100,
        metCount: 1,
        requirementCount: 1,
        requirements: [],
      },
    ],
  } as unknown as CompetenciesWorkspace;
  it("keeps an unassigned profile unassessed and excludes people outside the manager scope", async () => {
    const onMatrix = vi.fn();
    renderWith().render(
      <CompetenciesTeamOverview
        workspace={workspace}
        onSubject={vi.fn()}
        onPlan={vi.fn()}
        onMatrix={onMatrix}
        onPlans={vi.fn()}
        onReview={vi.fn()}
      />,
    );

    expect(screen.getByText("No actions require your attention.")).toBeVisible();
    const unassessed = screen.getByRole("heading", {
      name: "Not evaluated",
    }).parentElement!;
    expect(within(unassessed).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    const met = screen.getByRole("heading", {
      name: "All requirements met",
    }).parentElement!;
    expect(within(met).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    await userEvent.click(screen.getByRole("button", { name: "View All" }));
    expect(onMatrix).toHaveBeenCalledOnce();
  });
  it("filters every summary to people assigned to the selected job profile", () => {
    const value = structuredClone(workspace);
    value.people[1].canPlan = true;
    value.subjects = [
      { id: "employee", profileId: "junior" },
      { id: "other", profileId: "senior" },
    ];
    const renderOverview = (profileId: string) => (
      <CompetenciesTeamOverview
        workspace={value}
        profileId={profileId}
        onSubject={vi.fn()}
        onPlan={vi.fn()}
        onMatrix={vi.fn()}
        onPlans={vi.fn()}
        onReview={vi.fn()}
      />
    );
    const { rerender } = renderWith().render(renderOverview("junior"));
    expect(
      within(screen.getByRole("heading", { name: "Not evaluated" }).parentElement!).getByRole(
        "progressbar",
      ),
    ).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Employees: 1")).toBeVisible();
    rerender(renderOverview("senior"));
    expect(
      within(
        screen.getByRole("heading", { name: "All requirements met" }).parentElement!,
      ).getByRole("progressbar"),
    ).toHaveAttribute("aria-valuenow", "100");
    expect(
      within(screen.getByRole("heading", { name: "Not evaluated" }).parentElement!).getByRole(
        "progressbar",
      ),
    ).toHaveAttribute("aria-valuenow", "0");
  });
  it("opens each summary destination and calculates notes from current in-scope records", async () => {
    const definition = {
      id: "competency",
      name: "Communication",
      description: "",
      category: "",
      levels: [
        {
          id: "level",
          name: "Foundation",
          conditions: [
            {
              id: "condition",
              kind: "observation" as const,
              description: "Explain the weekly plan",
            },
          ],
        },
      ],
      revision: 1,
      archived: false,
    };
    const evidence: CompetenciesWorkspace["evidence"][number] = {
      id: "evidence",
      requestId: "request",
      subjectId: "employee",
      competencyId: definition.id,
      conditionIds: ["condition"],
      kind: "observation",
      occurredAt: "2026-10-17T10:00:00Z",
      validUntil: null,
      note: "Observation",
      version: 1,
      conditionRevisions: {},
      status: "pending",
      createdBy: "employee",
      reviewedBy: null,
      reviewedAt: null,
      reason: null,
    };
    const expiring = {
      subjectId: "employee",
      standing: {
        competencyId: definition.id,
        attainedLevelId: "level",
        currentLevelId: "level",
        effectiveFrom: null,
        effectiveUntil: "2026-10-25T10:00:00Z",
        expiring: true,
        levels: [
          {
            levelId: "level",
            met: true,
            conditions: [
              {
                conditionId: "condition",
                met: true,
                reason: null,
                evidenceIds: ["approved-proof"],
                effectiveFrom: "2026-10-01T10:00:00Z",
                effectiveUntil: "2026-10-25T10:00:00Z",
              },
            ],
          },
        ],
      },
    };
    const renewal: CompetenciesWorkspace["actions"][number] = {
      id: "renewal",
      version: 1,
      competencyRevision: 1,
      profileId: null,
      profileRevision: null,
      subjectId: "employee",
      competencyId: definition.id,
      levelId: "level",
      objective: "Renew",
      kind: "renewal",
      ownerId: "employee",
      dueDate: null,
      status: "cancelled",
      assignmentStatus: "not_requested",
      assignmentRequestId: null,
      createdBy: "employee",
    };
    const data = {
      ...workspace,
      warningDays: 30,
      catalog: [definition],
      evidence: [
        evidence,
        { ...evidence, id: "outside", subjectId: "other", occurredAt: "2026-01-01T00:00:00Z" },
      ],
      standings: [expiring, { ...expiring, subjectId: "other" }],
      actions: [renewal],
    };
    const onMatrix = vi.fn();
    const onPlans = vi.fn();
    const onReview = vi.fn();
    const view = renderWith().render(
      <CompetenciesTeamOverview
        workspace={data}
        onSubject={vi.fn()}
        onPlan={vi.fn()}
        onMatrix={onMatrix}
        onPlans={onPlans}
        onReview={onReview}
      />,
    );
    expect(screen.getByText("Unscheduled renewals: 1")).toBeVisible();
    const expiry = screen.getByRole("list", { name: "Expiring soon: Communication" });
    expect(
      within(expiry).getByText("Level 1 - Observation: Explain the weekly plan"),
    ).toBeVisible();
    expect(within(expiry).getByText(/Valid until 25 Oct 2026/)).toBeVisible();
    expect(screen.getByText("oldest evidence from 3 days ago")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /^Action Required/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Not confirmed/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Expiring in 30 Days/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Awaiting Approval/ }));
    expect(onMatrix).toHaveBeenCalledTimes(2);
    expect(onPlans).toHaveBeenCalledOnce();
    expect(onReview).toHaveBeenCalledWith("employee");
    view.rerender(
      <CompetenciesTeamOverview
        workspace={{ ...data, actions: [{ ...renewal, status: "in_progress" }] }}
        onSubject={vi.fn()}
        onPlan={vi.fn()}
        onMatrix={onMatrix}
        onPlans={onPlans}
        onReview={onReview}
      />,
    );
    expect(screen.getByText("Unscheduled renewals: 0")).toBeVisible();
  });
});
