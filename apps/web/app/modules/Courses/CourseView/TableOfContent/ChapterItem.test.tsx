import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import ChapterItem from "./ChapterItem";

import type { GetCourseResponse } from "~/api/generated-api";

type Chapter = GetCourseResponse["data"]["chapters"][number];

const onToggle = vi.fn();

const createChapter = (overrides: Partial<Chapter> = {}): Chapter =>
  ({
    id: "chapter-1",
    title: "Statistical Analysis",
    lessonCount: 3,
    chapterProgress: "in_progress",
    estimatedDurationSeconds: 4_800,
    lessons: [
      {
        id: "lesson-1",
        title: "Completed lesson",
        status: "completed",
        type: "content",
        displayOrder: 1,
        quizQuestionCount: null,
      },
      {
        id: "lesson-2",
        title: "Current lesson",
        status: "in_progress",
        type: "content",
        displayOrder: 2,
        quizQuestionCount: null,
      },
      {
        id: "lesson-3",
        title: "Next lesson",
        status: "not_started",
        type: "content",
        displayOrder: 3,
        quizQuestionCount: null,
      },
    ],
    ...overrides,
  }) as Chapter;

describe("ChapterItem", () => {
  it("shows active lesson progress for the current student chapter", () => {
    const { container } = renderWith().render(
      <ChapterItem
        chapter={createChapter()}
        chapterNumber={4}
        isAdminExperience={false}
        isExpanded={false}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("Statistical Analysis")).toBeInTheDocument();
    expect(screen.getByText("1 h 20 min")).toBeInTheDocument();
    expect(screen.getByText("3 lessons")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-primary-700")).toHaveLength(3);
    expect(container.querySelectorAll(".bg-primary-100")).toHaveLength(1);
  });

  it("does not show lesson progress in admin experience", () => {
    renderWith().render(
      <ChapterItem
        chapter={createChapter()}
        chapterNumber={4}
        isAdminExperience
        isExpanded={false}
        onToggle={onToggle}
      />,
    );

    expect(screen.queryByText("2/3")).not.toBeInTheDocument();
  });
});
