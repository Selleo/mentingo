import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CompetenciesTeam } from "./CompetenciesTeam";

import type { CompetenciesWorkspace } from "../competencies.types";

const definitions = [
  {
    id: "communication",
    name: "Communication",
    archived: false,
    levels: [
      { id: "first", name: "Foundation" },
      { id: "second", name: "Independent" },
    ],
  },
  {
    id: "quality",
    name: "Quality",
    archived: false,
    levels: [{ id: "first", name: "Foundation" }],
  },
  {
    id: "unassigned",
    name: "Unassigned catalog item",
    archived: false,
    levels: [{ id: "first", name: "Foundation" }],
  },
];
const requirements = [
  { competencyId: "communication", levelId: "first" },
  { competencyId: "quality", levelId: "first" },
];
const profile = { id: "profile", name: "Operations specialist", requirements };
const workspace = {
  catalog: definitions,
  people: [
    { id: "emma", name: "Emma Example", canPlan: true },
    { id: "alex", name: "Alex Example", canPlan: true },
    { id: "outside", name: "Other person", canPlan: false },
    { id: "other-job", name: "Different job", canPlan: true },
  ],
  subjects: ["emma", "alex", "outside"]
    .map((id) => ({ id, profileId: "profile" }))
    .concat([{ id: "other-job", profileId: "other-profile" }]),
  assessments: ["emma", "alex", "outside", "other-job"].map((subjectId) => ({
    subjectId,
    profileId: "profile",
    coverage: 50,
    requirements: requirements.map((requirement, index) => ({
      requirement,
      met: index === 0,
      standing: {
        currentLevelId: index === 0 ? "second" : null,
        attainedLevelId: "second",
        expiring: false,
        effectiveFrom: null,
        effectiveUntil: null,
      },
    })),
  })),
  profiles: [profile],
  publishedProfiles: [profile],
  asOf: "2026-10-20T10:00:00Z",
} as unknown as CompetenciesWorkspace;
const props = () => ({
  workspace,
  profiles: workspace.publishedProfiles,
  profileId: "profile",
  onProfileChange: vi.fn(),
  onSubject: vi.fn(),
});

describe("CompetenciesTeam matrix", () => {
  it("shows the job requirements and only employee names", async () => {
    const callbacks = props();
    renderWith().render(<CompetenciesTeam {...callbacks} />);
    const table = screen.getByRole("table", { name: "Matrix" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.queryByText("Unassigned catalog item")).not.toBeInTheDocument();
    expect(screen.queryByText("Other person")).not.toBeInTheDocument();
    expect(screen.queryByText("Different job")).not.toBeInTheDocument();
    expect(
      within(table).getByRole("row", { name: /Emma Example/ }).firstElementChild,
    ).toHaveTextContent(/^Emma Example$/);
    expect(screen.getByRole("heading", { name: "Operations specialist" })).toBeVisible();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      within(table).getAllByRole("img", {
        name: "Met. Current level: L2 - Independent. Required level: L1 - Foundation",
      })[0],
    ).toHaveTextContent(/^L1$/);
    expect(
      within(table).getAllByRole("img", {
        name: "Not confirmed. Current level: None. Required level: L1 - Foundation",
      })[0],
    ).toHaveTextContent("L1");
    await userEvent.click(screen.getByRole("button", { name: "Emma Example" }));
    expect(callbacks.onSubject).toHaveBeenCalledWith("emma");
  });

  it("keeps the status tooltip concise on hover and keyboard focus", async () => {
    renderWith().render(<CompetenciesTeam {...props()} />);
    expect(screen.getAllByRole("columnheader")[1]).toHaveTextContent(/^Communication$/);
    const trigger = screen.getAllByRole("button", {
      name: "Not confirmed. Current level: None. Required level: L1 - Foundation",
    })[0];
    await userEvent.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Competency gap · L1$/);
    await userEvent.unhover(trigger);
    await userEvent.click(screen.getByRole("textbox", { name: "Find person" }));
    for (let step = 0; step < 6 && document.activeElement !== trigger; step++)
      await userEvent.tab();
    expect(trigger).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Competency gap · L1$/);
    await userEvent.click(screen.getByRole("textbox", { name: "Find person" }));
    await userEvent.hover(
      screen.getAllByRole("button", {
        name: "Met. Current level: L2 - Independent. Required level: L1 - Foundation",
      })[0],
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Level met · L1$/);
  });

  it("offers job selection when multiple jobs exist without separating required competencies", async () => {
    const callbacks = props();
    renderWith().render(
      <CompetenciesTeam
        {...callbacks}
        profiles={[
          ...workspace.publishedProfiles,
          { ...workspace.publishedProfiles[0], id: "second", name: "Technician" },
        ]}
      />,
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    await userEvent.click(screen.getByRole("combobox", { name: "Job profile" }));
    await userEvent.click(screen.getByRole("option", { name: "Technician" }));
    expect(callbacks.onProfileChange).toHaveBeenCalledWith("second");
  });

  it("filters the matrix to matching people", async () => {
    renderWith().render(<CompetenciesTeam {...props()} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Find person" }), " Emma ");
    expect(screen.queryByRole("button", { name: "Alex Example" })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole("textbox", { name: "Find person" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Find person" }), "nobody");
    expect(screen.getByText("No people in this scope.")).toBeVisible();
  });

  it("keeps the required level and identifies the expiring condition in the matrix", async () => {
    const expiring = structuredClone(workspace);
    expiring.warningDays = 30;
    expiring.catalog[0].levels[0].conditions = [
      {
        id: "planning",
        kind: "observation",
        description: "Explain the weekly plan",
      },
    ];
    expiring.catalog[0].levels[1].conditions = [];
    expiring.assessments[0].requirements[0].standing.expiring = true;
    expiring.assessments[0].requirements[0].standing.effectiveUntil = "2026-11-10T10:00:00Z";
    expiring.assessments[0].requirements[0].standing.levels = [
      {
        levelId: "second",
        met: true,
        conditions: [
          {
            conditionId: "planning",
            met: true,
            reason: null,
            evidenceIds: ["observation"],
            effectiveFrom: "2026-10-01T10:00:00Z",
            effectiveUntil: "2026-11-10T10:00:00Z",
          },
        ],
      },
    ];
    renderWith().render(<CompetenciesTeam {...props()} workspace={expiring} />);
    expect(
      screen.getByRole("img", {
        name: "Expiring soon. Current level: L2 - Independent. Required level: L1 - Foundation",
      }),
    ).toHaveTextContent("L1");
    expect(screen.getByText(/Valid until 10 Nov 2026/)).toBeVisible();
    await userEvent.hover(
      screen.getByRole("button", {
        name: "Expiring soon. Current level: L2 - Independent. Required level: L1 - Foundation",
      }),
    );
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Level 1 - Observation: Explain the weekly plan");
    expect(tooltip).toHaveTextContent("Valid until 10 Nov 2026");
  });
});
