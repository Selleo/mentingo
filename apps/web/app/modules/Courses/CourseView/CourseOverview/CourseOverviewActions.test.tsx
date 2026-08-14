import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";

import CourseOverviewActions from "./CourseOverviewActions";

const enrollCourse = vi.fn();
let currentUser: { id: string } | undefined;
let inviteOnlyRegistration = false;
let course: { enrolled: boolean; id: string };
let isAdminExperience = false;
let canEditCourse = false;
let isCourseStudentModeActive = false;

vi.mock("~/api/mutations", () => ({
  useEnrollCourse: () => ({
    mutateAsync: enrollCourse,
    isPending: false,
  }),
}));

vi.mock("~/api/queries", () => ({
  availableCoursesQueryOptions: vi.fn(() => ({ queryKey: ["available-courses"] })),
  courseQueryOptions: vi.fn((id: string) => ({ queryKey: ["course", id] })),
  studentCoursesQueryOptions: vi.fn(() => ({ queryKey: ["student-courses"] })),
  useCurrentUser: () => ({ data: currentUser }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: { inviteOnlyRegistration } }),
}));

vi.mock("~/api/queries/useTopCourses", () => ({
  topCoursesQueryOptions: vi.fn(() => ({ queryKey: ["top-courses"] })),
}));

vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => ({ language: "en" }),
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course,
    isAdminExperience,
    canEditCourse,
    isCourseStudentModeActive,
  }),
}));

const renderActions = ({
  onContinueLearning = vi.fn(),
  onEnrollmentCompleted = vi.fn(),
  onToggleLearningMode = vi.fn(),
}: {
  onContinueLearning?: () => void;
  onEnrollmentCompleted?: () => void;
  onToggleLearningMode?: () => void;
} = {}) =>
  renderWith().render(
    <MemoryRouter initialEntries={["/course/course-1"]}>
      <Routes>
        <Route
          path="/course/:id"
          element={
            <CourseOverviewActions
              isTogglingLearningMode={false}
              onContinueLearning={onContinueLearning}
              onEnrollmentCompleted={onEnrollmentCompleted}
              onOpenDetails={vi.fn()}
              onToggleLearningMode={onToggleLearningMode}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("CourseOverviewActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = undefined;
    inviteOnlyRegistration = false;
    course = { enrolled: false, id: "course-1" };
    isAdminExperience = false;
    canEditCourse = false;
    isCourseStudentModeActive = false;
  });

  it("links unauthenticated users to registration when registration is open", () => {
    renderActions();

    expect(screen.getByTestId(COURSE_OVERVIEW_HANDLES.LOGIN_ENROLL_LINK)).toHaveAttribute(
      "href",
      "/auth/register",
    );
  });

  it("links unauthenticated users to login when registration is invite-only", () => {
    inviteOnlyRegistration = true;

    renderActions();

    expect(screen.getByTestId(COURSE_OVERVIEW_HANDLES.LOGIN_ENROLL_LINK)).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });

  it("lets an administrator exit learning mode", async () => {
    const user = userEvent.setup();
    const onToggleLearningMode = vi.fn();
    isAdminExperience = true;
    isCourseStudentModeActive = true;

    renderActions({ onToggleLearningMode });

    await user.click(screen.getByTestId(COURSE_OVERVIEW_HANDLES.STUDENT_MODE_BUTTON));

    expect(screen.getByText("Exit learning mode")).toBeInTheDocument();
    expect(onToggleLearningMode).toHaveBeenCalledOnce();
  });

  it("lets an enrolled learner continue learning", async () => {
    const user = userEvent.setup();
    const onContinueLearning = vi.fn();
    currentUser = { id: "user-1" };
    course = { enrolled: true, id: "course-1" };

    renderActions({ onContinueLearning });

    await user.click(screen.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON));

    expect(onContinueLearning).toHaveBeenCalledOnce();
  });

  it("notifies the overview after enrollment succeeds", async () => {
    const user = userEvent.setup();
    const onEnrollmentCompleted = vi.fn();
    currentUser = { id: "user-1" };

    renderActions({ onEnrollmentCompleted });

    await user.click(screen.getByTestId(COURSE_OVERVIEW_HANDLES.ENROLL_BUTTON));

    expect(enrollCourse).toHaveBeenCalledWith({ id: "course-1" });
    expect(onEnrollmentCompleted).toHaveBeenCalledOnce();
  });

  it("keeps course actions available on small screens", () => {
    currentUser = { id: "user-1" };
    course = { enrolled: true, id: "course-1" };

    renderActions();

    const actions = screen.getByTestId(COURSE_OVERVIEW_HANDLES.ACTIONS);

    expect(actions).toHaveClass("flex", "flex-wrap");
    expect(actions).not.toHaveClass("hidden");
    expect(screen.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON)).toBeVisible();
    expect(screen.getByTestId(COURSE_OVERVIEW_HANDLES.DETAILS_BUTTON)).toBeVisible();
  });
});
