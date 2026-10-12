import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringScopePopover } from "./AuthoringScopePopover";

import type { CourseContext } from "../courseAuthoring.types";

const course: CourseContext = {
  courseId: "course-1",
  language: "en",
  title: "Safety",
  description: "",
  baselineHash: "course-hash",
  fieldHashes: {},
  chapters: [
    {
      id: "chapter-1",
      title: "First chapter",
      displayOrder: 0,
      baselineHash: "chapter-hash",
      lessons: [
        {
          id: "lesson-1",
          title: "First lesson",
          lessonType: "content",
          displayOrder: 0,
          baselineHash: "lesson-1-hash",
          blocks: [{ id: "block-1", html: "<p>First</p>", baselineHash: "block-hash" }],
        },
        {
          id: "lesson-2",
          title: "Second lesson",
          lessonType: "legacy_type",
          displayOrder: 1,
          baselineHash: "lesson-2-hash",
          blocks: [{ id: "block-2", html: "<p>Second</p>", baselineHash: "block-2-hash" }],
        },
      ],
    },
  ],
};

const ScopeHarness = () => {
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  return (
    <AuthoringScopePopover
      course={course}
      selectedTargetIds={selectedTargetIds}
      selectedBlockIds={selectedBlockIds}
      onSelectedTargetIdsChange={setSelectedTargetIds}
      onSelectedBlockIdsChange={setSelectedBlockIds}
    />
  );
};

describe("AuthoringScopePopover", () => {
  it("preserves sibling lessons and clears only the owning block or parent", async () => {
    const user = userEvent.setup();
    renderWith().render(<ScopeHarness />);
    await user.click(screen.getByRole("button", { name: "Entire course" }));

    const chapterButtons = screen.getAllByRole("button", { name: /First chapter/ });
    await user.click(chapterButtons[1]);
    await user.click(screen.getByRole("button", { name: "First lesson Content" }));
    await user.click(screen.getByRole("button", { name: "Select block 1 from Second lesson" }));
    expect(screen.getByRole("button", { name: "2 selected" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "First lesson Content" }));
    await user.click(screen.getByRole("button", { name: "Select block 1 from First lesson" }));
    expect(screen.getByRole("button", { name: "2 selected" })).toBeVisible();

    await user.click(chapterButtons[0]);
    expect(screen.getByRole("button", { name: "1 selected" })).toBeVisible();
  });

  it("uses the neutral lesson label for legacy lesson kinds", async () => {
    const user = userEvent.setup();
    renderWith().render(<ScopeHarness />);
    await user.click(screen.getByRole("button", { name: "Entire course" }));
    await user.click(screen.getAllByRole("button", { name: /First chapter/ })[1]);
    expect(screen.getByText("Lesson", { exact: true })).toBeVisible();
  });
});
