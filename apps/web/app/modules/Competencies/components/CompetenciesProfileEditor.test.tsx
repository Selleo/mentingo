import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CompetenciesProfileEditor } from "./CompetenciesProfileEditor";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { competenciesControllerExecuteCompetenciesCommand: execute } },
}));
vi.mock("~/api/queries/useCompetencyCatalog", () => ({
  useCompetencyCatalog: () => ({ data: { data: [] }, isPending: false, isFetching: false }),
}));
vi.mock("~/api/queries/useCompetencyCategories", () => ({
  useCompetencyCategories: () => ({ data: { data: [] } }),
}));
vi.mock("~/api/queries/useCompetencyOptions", () => ({
  useCompetencyOptions: () => ({ data: { courses: [], people: [] } }),
}));

async function openCompetencyEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: /Add competency/ }));
  await user.type(screen.getByPlaceholderText("Search…"), "Missing competency");
  await user.click(screen.getByRole("option", { name: "Add competency" }));
  return within(await screen.findByRole("dialog", { name: "Add competency" }));
}

async function fillCompetency(user: ReturnType<typeof userEvent.setup>) {
  const editor = await openCompetencyEditor(user);
  await user.type(editor.getByLabelText("Name"), "First aid");
  await user.click(editor.getByRole("button", { name: "Add level" }));
  await user.type(editor.getByLabelText("Level 1 name"), "Basic");
  await user.click(editor.getByRole("button", { name: "Add level" }));
  await user.type(editor.getByLabelText("Level 2 name"), "Advanced");
  return editor;
}

describe("inline competency creation in job profiles", () => {
  beforeEach(() => {
    execute.mockReset();
    execute.mockResolvedValue({ data: { data: { id: "created-competency" } } });
  });

  it.each([false, true])(
    "assigns the saved competency without a catalog refetch (editing: %s)",
    async (editing) => {
      const user = userEvent.setup();
      const close = vi.fn();
      const requirements = [{ competencyId: "existing", levelId: "existing-level" }];
      const profile = editing
        ? {
            id: "profile",
            revision: 3,
            assignedPeopleCount: 0,
            name: "",
            description: "",
            requirements,
          }
        : undefined;
      renderWith({ withQuery: true }).render(
        <CompetenciesProfileEditor profile={profile} close={close} />,
      );
      await user.type(screen.getByLabelText("Name"), "Paramedic");
      await user.type(screen.getByLabelText("Description"), "Draft description");
      const editor = await fillCompetency(user);
      await user.click(editor.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Add competency" })).not.toBeInTheDocument(),
      );
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation: "save_competency" }),
      );
      expect(close).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Name")).toHaveValue("Paramedic");
      expect(screen.getByLabelText("Description")).toHaveValue("Draft description");
      const levelPicker = screen.getByRole("combobox", { name: "Required level: First aid" });
      expect(levelPicker).toHaveTextContent("Basic");
      await user.click(levelPicker);
      await user.click(screen.getByRole("option", { name: /Advanced/ }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(close).toHaveBeenCalledOnce());
      const savedCompetency = execute.mock.calls[0][0].value;
      expect(execute.mock.calls[1][0]).toMatchObject({
        operation: "save_profile",
        value: {
          name: "Paramedic",
          description: "Draft description",
          requirements: [
            ...(editing ? requirements : []),
            { competencyId: "created-competency", levelId: savedCompetency.levels[1].id },
          ],
        },
      });
    },
  );

  it("cancels competency creation without changing an edited profile or saving anything", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const profile = {
      id: "profile",
      revision: 3,
      assignedPeopleCount: 0,
      name: "Paramedic",
      description: "Existing description",
      requirements: [{ competencyId: "existing", levelId: "existing-level" }],
    };
    renderWith({ withQuery: true }).render(
      <CompetenciesProfileEditor profile={profile} close={close} />,
    );
    await user.type(screen.getByLabelText("Name"), " updated");
    const editor = await fillCompetency(user);
    await user.click(editor.getByRole("button", { name: "Cancel" }));
    expect(execute).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveValue("Paramedic updated");
    expect(screen.getByLabelText("Description")).toHaveValue("Existing description");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(execute).toHaveBeenCalledWith({
      operation: "save_profile",
      id: "profile",
      revision: 3,
      value: {
        name: "Paramedic updated",
        description: profile.description,
        requirements: profile.requirements,
      },
    });
  });

  it("retains both drafts on error and assigns exactly once after retry", async () => {
    const user = userEvent.setup();
    execute.mockRejectedValueOnce(new Error("Unavailable"));
    renderWith({ withQuery: true }).render(<CompetenciesProfileEditor close={vi.fn()} />);
    await user.type(screen.getByLabelText("Name"), "Paramedic");
    const editor = await fillCompetency(user);
    await user.click(editor.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editor.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(editor.getByLabelText("Name")).toHaveValue("First aid");
    expect(execute).toHaveBeenCalledTimes(1);
    await user.click(editor.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add competency" })).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Paramedic");
    expect(screen.getAllByRole("combobox", { name: "Required level: First aid" })).toHaveLength(1);
    expect(execute.mock.calls.map(([command]) => command.operation)).toEqual([
      "save_competency",
      "save_competency",
    ]);
  });

  it("blocks profile submission while the competency dialog is open and pending", async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => {};
    execute.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const close = vi.fn();
    renderWith({ withQuery: true }).render(<CompetenciesProfileEditor close={close} />);
    const profileForm = screen.getByLabelText("Name").closest("form");
    if (!profileForm) throw new Error("Missing profile form");
    await user.type(screen.getByLabelText("Name"), "Paramedic");
    const editor = await fillCompetency(user);
    await act(async () => {
      fireEvent.submit(profileForm);
    });
    expect(execute).not.toHaveBeenCalled();
    await user.click(editor.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editor.getByRole("button", { name: "Saving..." })).toBeDisabled());
    expect(editor.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(editor.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog", { name: "Add competency" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.submit(profileForm);
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish({ data: { data: { id: "created-competency" } } }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add competency" })).not.toBeInTheDocument(),
    );
  });

  it("requires a level before saving a competency for a profile", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<CompetenciesProfileEditor close={vi.fn()} />);
    const editor = await openCompetencyEditor(user);
    await user.type(editor.getByLabelText("Name"), "First aid");
    expect(editor.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(execute).not.toHaveBeenCalled();
    await user.click(editor.getByRole("button", { name: "Add level" }));
    await user.type(editor.getByLabelText("Level 1 name"), "Basic");
    expect(editor.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("keeps category and competency portal form submissions separate from the profile", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<CompetenciesProfileEditor close={vi.fn()} />);
    await user.type(screen.getByLabelText("Name"), "Paramedic");
    const editor = await fillCompetency(user);
    await user.click(editor.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "New category" }));
    const category = within(await screen.findByRole("dialog", { name: "New category" }));
    await user.type(category.getByLabelText("Name"), "Safety");
    await user.click(category.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "New category" })).not.toBeInTheDocument(),
    );
    expect(editor.getByRole("combobox", { name: "Category" })).toHaveTextContent("Safety");
    expect(execute.mock.calls.map(([command]) => command.operation)).toEqual(["save_category"]);
    expect(document.querySelector("form form")).toBeNull();
    await user.click(editor.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add competency" })).not.toBeInTheDocument(),
    );
    expect(execute.mock.calls.map(([command]) => command.operation)).toEqual([
      "save_category",
      "save_competency",
    ]);
    expect(screen.getByLabelText("Name")).toHaveValue("Paramedic");
  });
});
