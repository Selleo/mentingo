import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import AuthorModal from "./AuthorModal";

describe("AuthorModal", () => {
  it("renders other courses with enrolled students, hardcoded rating, and half-hour duration", () => {
    renderWith().render(
      <AuthorModal
        author={{
          firstName: "Ada",
          lastName: "Lovelace",
          jobTitle: "Instructor",
          description: "Teaches practical software courses.",
        }}
        isAdminExperience={false}
        isSaving={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggleShowAuthorSection={vi.fn()}
        otherCourses={[
          {
            id: "course-2",
            title: "Advanced React",
            category: "Frontend",
            enrolledParticipantCount: 42,
            estimatedDurationMinutes: 61,
          },
        ]}
        showAuthorSectionDraft
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Other courses")).toBeInTheDocument();
    expect(screen.getByText("Advanced React")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("1 h 30 min")).toBeInTheDocument();
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
});
