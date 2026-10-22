import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { renderWith } from "~/utils/testUtils";

import { CompetenciesProfiles, CompetenciesProfileEditor } from "./CompetenciesProfiles";

import type { CompetenciesWorkspace } from "../competencies.types";

vi.mock("~/api/mutations/useExecuteCompetenciesCommand");

describe("CompetenciesProfiles", () => {
  it.each([
    { archived: true, levels: [{ id: "foundation", name: "Foundation", conditions: [] }] },
    { archived: false, levels: [] },
  ])("allows removing an existing unavailable requirement: %j", async (unavailable) => {
    const execute = vi.fn().mockResolvedValue({ id: "profile" });
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: execute,
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const workspace = {
      catalog: [
        { id: "selected", name: "Retired competency", ...unavailable },
        { id: "unselected", name: "Unavailable competency", ...unavailable },
      ],
      profiles: [
        {
          id: "profile",
          name: "Job profile",
          description: "Existing requirements",
          revision: 2,
          status: "published",
          requirements: [{ competencyId: "selected", levelId: "foundation" }],
        },
      ],
      subjects: [],
    } as unknown as CompetenciesWorkspace;

    renderWith().render(
      <CompetenciesProfileEditor
        workspace={workspace}
        profile={workspace.profiles[0]}
        close={vi.fn()}
      />,
    );
    const requirement = screen.getByRole("checkbox", { name: "Retired competency" });
    expect(requirement).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Unavailable competency" })).toBeNull();
    await userEvent.click(requirement);
    expect(screen.queryByRole("checkbox", { name: "Retired competency" })).toBeNull();
    expect(screen.getByRole("group", { name: "Required competencies" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(execute).toHaveBeenCalledWith({
      operation: "save_profile",
      id: "profile",
      revision: 2,
      value: {
        name: "Job profile",
        description: "Existing requirements",
        requirements: [],
      },
    });
  });
  it("shows names and active status without a duplicate heading or profile descriptions", async () => {
    vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
    const profile = {
      id: "profile",
      name: "Operations specialist",
      description: "Internal profile details",
      requirements: [],
    };
    const onEdit = vi.fn();
    renderWith().render(
      <CompetenciesProfiles
        workspace={{ profiles: [profile], subjects: [] } as unknown as CompetenciesWorkspace}
        onEdit={onEdit}
      />,
    );
    expect(screen.queryByRole("heading", { name: "Job Profiles" })).not.toBeInTheDocument();
    expect(screen.queryByText(profile.description)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: profile.name })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: profile.name })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(profile.name));
    expect(onEdit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(profile);
  });
  it.each([false, true])(
    "confirms deletion and protects assigned profiles: assigned=%s",
    async (assigned) => {
      const execute = vi.fn().mockResolvedValue({ id: "profile" });
      vi.mocked(useExecuteCompetenciesCommand).mockReturnValue({
        mutateAsync: execute,
        isPending: false,
      } as unknown as ReturnType<typeof useExecuteCompetenciesCommand>);
      const profile = {
        id: "profile",
        name: "Operator",
        description: "",
        revision: 3,
        requirements: [],
      };
      const close = vi.fn();
      renderWith().render(
        <CompetenciesProfileEditor
          workspace={
            {
              catalog: [],
              subjects: assigned ? [{ id: "employee", profileId: profile.id }] : [],
            } as unknown as CompetenciesWorkspace
          }
          profile={profile as unknown as CompetenciesWorkspace["profiles"][number]}
          close={close}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Delete" }));
      const confirmation = within(screen.getByRole("alertdialog"));
      expect(execute).not.toHaveBeenCalled();
      if (assigned) {
        expect(
          confirmation.getByText("Unassign employees before deleting this profile."),
        ).toBeVisible();
        expect(confirmation.getByRole("button", { name: "Delete" })).toBeDisabled();
        await userEvent.click(confirmation.getByRole("button", { name: "Cancel" }));
        expect(close).not.toHaveBeenCalled();
        return;
      }
      await userEvent.click(confirmation.getByRole("button", { name: "Delete" }));
      expect(execute).toHaveBeenCalledWith({
        operation: "delete_profile",
        id: profile.id,
        revision: profile.revision,
      });
      expect(close).toHaveBeenCalledOnce();
    },
  );
});
