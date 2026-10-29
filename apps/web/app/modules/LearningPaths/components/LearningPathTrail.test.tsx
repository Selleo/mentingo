import { COURSE_PROGRESS_STATUSES } from "@repo/shared";
import { screen } from "@testing-library/react";

import { renderWith } from "~/utils/testUtils";

import { LearningPathTrail } from "./LearningPathTrail";

import type { LearningPathCoursePreview } from "./learningPaths.types";

const course: LearningPathCoursePreview = {
  id: "learning-path-course-1",
  learningPathId: "learning-path-1",
  courseId: "course-1",
  displayOrder: 0,
  title: "Course one",
  description: "Course description",
  thumbnailUrl: null,
  courseChapterCount: 1,
  progress: COURSE_PROGRESS_STATUSES.NOT_STARTED,
  isLocked: true,
  completedAt: null,
};

const renderTrail = (showProgress: boolean) =>
  renderWith().render(
    <LearningPathTrail
      courses={[course]}
      availableCourseOptions={[]}
      canManage={false}
      canOpenCourses={false}
      showProgress={showProgress}
      isPending={false}
      onAddCourses={async () => {}}
      onReorderCourses={async () => {}}
      onRemoveCourse={async () => {}}
    />,
  );

describe("LearningPathTrail", () => {
  it("shows course progress for learners", () => {
    renderTrail(true);

    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("hides course progress for the Group Manager view", () => {
    renderTrail(false);

    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });
});
