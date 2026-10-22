import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CompetenciesPeople } from "./CompetenciesPeople";

import type { CompetenciesWorkspace } from "../competencies.types";

const execute = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("~/api/mutations/useExecuteCompetenciesCommand", () => ({
  useExecuteCompetenciesCommand: () => ({ mutateAsync: execute, isPending: false }),
}));

const workspace = {
  people: [
    {
      id: "emma",
      name: "Emma Example",
      archived: false,
      canPlan: true,
    },
    { id: "alex", name: "Alex Example", archived: false, canPlan: false },
    { id: "archived", name: "Archived Example", archived: true, canPlan: true },
  ],
  subjects: [{ id: "emma", profileId: "operator" }],
  publishedProfiles: [{ id: "operator", name: "Operator", requirements: [] }],
  standings: [
    {
      subjectId: "emma",
      standing: { competencyId: "communication", currentLevelId: "foundation" },
    },
    {
      subjectId: "emma",
      standing: { competencyId: "quality", currentLevelId: null },
    },
  ],
  catalog: [
    {
      id: "communication",
      name: "Communication",
      levels: [{ id: "foundation", name: "Foundation" }],
    },
  ],
} as unknown as CompetenciesWorkspace;

describe("CompetenciesPeople", () => {
  it("scopes managers to managed people and includes people without competency records", () => {
    renderWith().render(
      <CompetenciesPeople workspace={workspace} canManage={false} onSubject={vi.fn()} />,
    );

    expect(screen.getByText("Emma Example")).toBeVisible();
    expect(screen.queryByText("Alex Example")).not.toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeVisible();
    expect(screen.getByText("Communication: Foundation")).toBeVisible();
    expect(screen.queryByText("Archived Example")).not.toBeInTheDocument();
  });

  it("lets administrators browse every employee and open the selected subject", async () => {
    const onSubject = vi.fn();
    renderWith().render(
      <CompetenciesPeople workspace={workspace} canManage onSubject={onSubject} />,
    );

    expect(screen.getByText("Emma Example")).toBeVisible();
    expect(screen.getByText("Alex Example")).toBeVisible();
    expect(screen.queryByText("Archived Example")).not.toBeInTheDocument();
    expect(screen.queryByText("Quality")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Alex Example" }));
    expect(onSubject).toHaveBeenCalledWith("alex");
  });

  it("assigns and unassigns profiles only for people the actor may plan", async () => {
    execute.mockClear();
    const view = renderWith().render(
      <CompetenciesPeople workspace={workspace} canManage={false} onSubject={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Job profile: Emma Example" }));
    await userEvent.click(screen.getByRole("option", { name: "No assigned profile" }));
    expect(execute).toHaveBeenCalledWith({
      operation: "assign_profile",
      subjectId: "emma",
      profileId: null,
    });
    expect(screen.queryByRole("combobox", { name: "Job profile: Alex Example" })).toBeNull();
    view.unmount();

    renderWith().render(<CompetenciesPeople workspace={workspace} canManage onSubject={vi.fn()} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Job profile: Alex Example" }));
    await userEvent.click(screen.getByRole("option", { name: "Operator" }));
    expect(execute).toHaveBeenCalledWith({
      operation: "assign_profile",
      subjectId: "alex",
      profileId: "operator",
    });
  });
});
