import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LessonContentRenderer } from "./LessonContentRenderer";

import type { GetLessonByIdResponse } from "~/api/generated-api";

const state = vi.hoisted(() => ({ preview: true }));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useOptionalCourseAccessProvider: () => ({ isPreviewMode: state.preview }),
}));
vi.mock("~/components/RichText/Viever", () => ({
  default: ({ content }: { content: string }) => <p>{content}</p>,
}));
vi.mock("./AiMentorLesson/AiMentorLesson", () => ({
  default: () => <button>Start AI activity</button>,
}));
vi.mock("./ScormLesson/ScormLesson", () => ({
  ScormLesson: () => <button>Launch SCORM</button>,
}));
vi.mock("./LiveTrainingLesson/LiveTrainingLesson", () => ({
  LiveTrainingLesson: () => <button>Join live training</button>,
}));
vi.mock("./Quiz", () => ({ Quiz: () => <p>Quiz questions</p> }));
vi.mock("./EmbedLesson/EmbedLesson", () => ({ EmbedLesson: () => <p>Embedded content</p> }));

const renderLesson = (type: GetLessonByIdResponse["data"]["type"]) =>
  renderWith().render(
    <LessonContentRenderer
      lesson={
        {
          id: "lesson-1",
          type,
          description: "Activity description",
        } as GetLessonByIdResponse["data"]
      }
      user={undefined}
      lessonLoading={false}
    />,
  );

describe("LessonContentRenderer preview activities", () => {
  beforeEach(() => {
    state.preview = true;
  });

  it.each(["ai_mentor", "scorm", "live_training"] as const)(
    "shows the description without mounting the interactive %s activity in preview",
    (type) => {
      renderLesson(type);
      expect(screen.getByText("Activity description")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("shows quiz questions in preview", () => {
    renderLesson("quiz");
    expect(screen.getByText("Quiz questions")).toBeInTheDocument();
  });

  it("mounts learning activities once the user starts learning", () => {
    state.preview = false;
    renderLesson("ai_mentor");
    expect(screen.getByRole("button", { name: "Start AI activity" })).toBeInTheDocument();
  });
});
