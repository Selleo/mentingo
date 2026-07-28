import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CHAPTER_PROGRESS_STATUSES } from "../lessonTypes";

import ChapterList from "./ChapterList";

type TestChapter = {
  chapterProgress: string;
  id: string;
  title: string;
};

const courseAccessState = vi.hoisted(() => ({
  course: {
    chapters: [] as TestChapter[],
    id: "course-1",
    slug: "course-slug",
  },
}));

vi.mock("~/hooks/useLessonsSequence", () => ({
  useLessonsSequence: () => ({
    sequenceEnabled: false,
  }),
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: courseAccessState.course,
    isAdminExperience: false,
    isPreviewMode: false,
  }),
}));

vi.mock("../../utils", () => ({
  getChaptersWithAccess: (chapters: TestChapter[]) => chapters,
}));

vi.mock("./ChapterItem", () => ({
  default: ({ chapter }: { chapter: TestChapter }) => <div>{chapter.title}</div>,
}));

describe("ChapterList", () => {
  beforeEach(() => {
    courseAccessState.course.chapters = [];
  });

  it("shows the first two remaining chapters and the correct hidden count without an in-progress chapter", () => {
    courseAccessState.course.chapters = [
      {
        id: "chapter-1",
        title: "Chapter 1",
        chapterProgress: CHAPTER_PROGRESS_STATUSES.NOT_STARTED,
      },
      {
        id: "chapter-2",
        title: "Chapter 2",
        chapterProgress: CHAPTER_PROGRESS_STATUSES.NOT_STARTED,
      },
      {
        id: "chapter-3",
        title: "Chapter 3",
        chapterProgress: CHAPTER_PROGRESS_STATUSES.NOT_STARTED,
      },
      {
        id: "chapter-4",
        title: "Chapter 4",
        chapterProgress: CHAPTER_PROGRESS_STATUSES.NOT_STARTED,
      },
    ];

    renderWith().render(
      <ChapterList
        completedExpanded={false}
        expandedChapters={[]}
        isMobile
        onExpandCompleted={vi.fn()}
        onShowAllChapters={vi.fn()}
        onToggleChapter={vi.fn()}
        showAllChapters={false}
      />,
    );

    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Chapter 2")).toBeInTheDocument();
    expect(screen.queryByText("Chapter 3")).not.toBeInTheDocument();
    expect(screen.queryByText("Chapter 4")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all chapters (2 more)" })).toBeInTheDocument();
  });
});
