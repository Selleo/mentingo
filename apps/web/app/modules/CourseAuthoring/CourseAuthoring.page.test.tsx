import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CourseAuthoringPage from "./CourseAuthoring.page";

const route = vi.hoisted(() => ({ courseId: "course-a", sessionId: "session-a" }));

vi.mock("@remix-run/react", () => ({
  useParams: () => ({ id: route.courseId }),
  useSearchParams: () => [new URLSearchParams({ sessionId: route.sessionId })],
}));
vi.mock("~/api/queries/useCourseAuthoringSessionsQuery", () => ({
  useCourseAuthoringSessionsQuery: () => ({ data: [] }),
}));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: (select: (state: { language: string }) => string) => select({ language: "en" }),
}));
vi.mock("./CourseGenerationSession", () => ({
  CourseGenerationSession: ({ courseId, sessionId }: { courseId: string; sessionId: string }) => {
    // Like trackedApplication/exportId, this state belongs to the mounted session controller.
    const [applicationOwner] = useState(`${courseId}:${sessionId}`);
    return <output aria-label="Application owner">{applicationOwner}</output>;
  },
}));

describe("authoring notification destination", () => {
  beforeEach(() => {
    route.courseId = "course-a";
    route.sessionId = "session-a";
  });

  it("resets mounted application state when navigation opens a different session", () => {
    const { rerender } = render(<CourseAuthoringPage />);
    expect(screen.getByLabelText("Application owner")).toHaveTextContent("course-a:session-a");
    route.sessionId = "session-b";
    rerender(<CourseAuthoringPage />);
    expect(screen.getByLabelText("Application owner")).toHaveTextContent("course-a:session-b");
  });

  it("resets mounted application state when navigation changes the course", () => {
    const { rerender } = render(<CourseAuthoringPage />);
    route.courseId = "course-b";
    rerender(<CourseAuthoringPage />);
    expect(screen.getByLabelText("Application owner")).toHaveTextContent("course-b:session-a");
  });
});
