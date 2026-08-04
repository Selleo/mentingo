import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";

import AuthorModal from "./AuthorModal";

describe("AuthorModal", () => {
  it("has dialog semantics and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWith().render(
      <AuthorModal
        author={{ firstName: "Ada", lastName: "Lovelace" }}
        isAdminExperience={false}
        isSaving={false}
        onClose={onClose}
        onSave={vi.fn()}
        onToggleShowAuthorSection={vi.fn()}
        otherCourses={[]}
        showAuthorSectionDraft
      />,
    );

    expect(screen.getByRole("dialog", { name: "Ada Lovelace" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders linked courses and closes before navigating to one", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWith().render(
      <MemoryRouter>
        <AuthorModal
          author={{
            firstName: "Ada",
            lastName: "Lovelace",
            jobTitle: "Instructor",
            description: "Teaches practical software courses.",
          }}
          isAdminExperience={false}
          isSaving={false}
          onClose={onClose}
          onSave={vi.fn()}
          onToggleShowAuthorSection={vi.fn()}
          otherCourses={[
            {
              id: "course-2",
              slug: "advanced-react",
              title: "Advanced React",
              category: "Frontend",
              enrolledParticipantCount: 42,
              estimatedDurationMinutes: 61,
            },
          ]}
          showAuthorSectionDraft
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Other courses")).toBeInTheDocument();
    expect(screen.getByText("Advanced React")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("1 h 30 min")).toBeInTheDocument();
    const courseLink = screen.getByRole("link", { name: /Advanced React/ });

    expect(courseLink).toHaveAttribute("href", "/course/advanced-react");

    await user.click(courseLink);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("lets admins toggle and save author section visibility", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onToggleShowAuthorSection = vi.fn();

    renderWith().render(
      <AuthorModal
        author={{
          firstName: "Ada",
          lastName: "Lovelace",
        }}
        isAdminExperience
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
        onToggleShowAuthorSection={onToggleShowAuthorSection}
        otherCourses={[]}
        showAuthorSectionDraft
      />,
    );

    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onToggleShowAuthorSection).toHaveBeenCalledWith(false);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("lets admins transfer ownership inline from the author name", async () => {
    const user = userEvent.setup();
    const onTransferOwner = vi.fn().mockResolvedValue(undefined);

    renderWith().render(
      <AuthorModal
        author={{ firstName: "Ada", lastName: "Lovelace" }}
        canEditOwner
        courseOwnershipCandidates={[
          { id: "candidate-1", name: "Grace Hopper", email: "grace@example.com" },
        ]}
        isAdminExperience
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onTransferOwner={onTransferOwner}
        onToggleShowAuthorSection={vi.fn()}
        otherCourses={[]}
        showAuthorSectionDraft
      />,
    );

    await user.click(screen.getByTestId(COURSE_OVERVIEW_HANDLES.AUTHOR_TRANSFER_BUTTON));
    await user.click(
      screen.getByTestId(COURSE_OVERVIEW_HANDLES.transferOwnershipOption("candidate-1")),
    );

    expect(onTransferOwner).toHaveBeenCalledWith("candidate-1");
  });
});
