import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { renderWith } from "~/utils/testUtils";

import { CompetenciesCatalog, CompetenciesCatalogEditor } from "./CompetenciesCatalog";

import type { CompetenciesWorkspace } from "../competencies.types";

vi.mock("~/api/mutations/useExecuteCompetenciesCommand");

const competency = {
  id: "competency",
  name: "Communication",
  description: "Explain clearly",
  category: "Interpersonal",
  revision: 3,
  archived: false,
  levels: [
    {
      id: "foundation",
      name: "Foundation",
      conditions: [
        {
          id: "conversation",
          kind: "observation",
          description: "Demonstrate a conversation",
        },
      ],
    },
  ],
};
const workspace = {
  catalog: [
    competency,
    { ...competency, id: "archived", name: "Archived definition", archived: true },
  ],
  people: [{ id: "active", name: "Active verifier", archived: false }],
  verifiers: { competency: ["deleted"] },
  courses: [],
  learningResources: [],
} as unknown as CompetenciesWorkspace;

function mockCommand(execute = vi.fn().mockResolvedValue({ id: "competency" })) {
  vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
    mutateAsync: execute,
    isPending: false,
  } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
  return execute;
}

describe("CompetenciesCatalog", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
  });

  it("keeps level edits when switching, adding, reordering and removing tabs", async () => {
    const execute = mockCommand();
    renderWith().render(
      <CompetenciesCatalogEditor
        workspace={workspace}
        value={workspace.catalog[0]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Each level requires/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Level name"), " edited");
    await userEvent.click(screen.getByRole("button", { name: "Add level" }));
    expect(screen.getByRole("tab", { name: "Level 2" })).toHaveAttribute("aria-selected", "true");
    await userEvent.type(
      within(screen.getByRole("tabpanel")).getByLabelText("Level name"),
      "Independent",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Level 1" }));
    expect(within(screen.getByRole("tabpanel")).getByLabelText("Level name")).toHaveValue(
      "Foundation edited",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Level 2" }));
    await userEvent.click(
      within(screen.getByRole("tabpanel")).getByRole("button", { name: "Move left" }),
    );
    expect(screen.getByRole("tab", { name: "Level 1" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(
      within(screen.getByRole("tabpanel")).getByRole("button", { name: /^Remove$/ }),
    );
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(execute).toHaveBeenCalled());
    expect(execute.mock.calls[0][0].value.levels).toEqual([
      expect.objectContaining({ name: "Foundation edited" }),
    ]);
  });

  it("selects an invalid level before saving so hidden fields keep their validation", async () => {
    const execute = mockCommand();
    renderWith().render(
      <CompetenciesCatalogEditor
        workspace={workspace}
        value={workspace.catalog[0]}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add level" }));
    await userEvent.click(screen.getByRole("tab", { name: "Level 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("tab", { name: "Level 2" })).toHaveAttribute("aria-selected", "true");
    expect(execute).not.toHaveBeenCalled();
  });
  it("opens an active card for editing without separate footer actions", async () => {
    const onEdit = vi.fn();
    renderWith().render(<CompetenciesCatalog workspace={workspace} onEdit={onEdit} />);
    expect(screen.queryByRole("button", { name: "Archived definition" })).not.toBeInTheDocument();
    expect(screen.getByText("Max level L1")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Communication" }));
    expect(onEdit).toHaveBeenCalledWith(competency);
  });

  it("saves the definition and a searchable verifier selection in one editor", async () => {
    const execute = mockCommand();
    const onClose = vi.fn();
    renderWith().render(
      <CompetenciesCatalogEditor
        workspace={workspace}
        value={workspace.catalog[0]}
        onClose={onClose}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("Verifiers"), "Active");
    await userEvent.click(await screen.findByRole("option", { name: "Active verifier" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(execute).toHaveBeenNthCalledWith(1, {
      operation: "save_competency",
      id: "competency",
      revision: 3,
      value: expect.objectContaining({ name: "Communication" }),
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0].value.levels[0].conditions[0].verifierIds).toEqual(["active"]);
  });
  it("keeps AI Mentor assessments and shows verifiers only for manual conditions", async () => {
    mockCommand();
    renderWith().render(
      <CompetenciesCatalogEditor
        workspace={workspace}
        value={workspace.catalog[0]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Verifiers")).toBeVisible();
    for (const name of ["Course", "Quiz", "AI Mentor assessment"]) {
      await userEvent.click(screen.getByRole("combobox", { name: "Condition type" }));
      await userEvent.click(screen.getByRole("option", { name }));
      expect(screen.queryByPlaceholderText("Verifiers")).not.toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole("combobox", { name: "Condition type" }));
    await userEvent.click(screen.getByRole("option", { name: "Document" }));
    expect(screen.getByPlaceholderText("Verifiers")).toBeVisible();
  });

  it("preserves the draft when the atomic definition save fails", async () => {
    const execute = mockCommand(
      vi.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({ id: "created" }),
    );
    const onClose = vi.fn();
    renderWith().render(<CompetenciesCatalogEditor workspace={workspace} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("Name", { exact: true }), "New competency");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("New competency");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(execute).toHaveBeenNthCalledWith(2, {
      operation: "save_competency",
      id: undefined,
      revision: undefined,
      value: expect.objectContaining({ name: "New competency" }),
    });
  });

  it("archives from the editor and preserves the form on failure", async () => {
    const execute = mockCommand(
      vi.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({}),
    );
    const onClose = vi.fn();
    renderWith().render(
      <CompetenciesCatalogEditor
        workspace={workspace}
        value={workspace.catalog[0]}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(execute).toHaveBeenLastCalledWith({
      operation: "archive_competency",
      id: "competency",
      revision: 3,
    });
  });
});
