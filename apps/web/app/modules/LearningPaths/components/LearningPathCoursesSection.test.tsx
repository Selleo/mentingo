import { COURSE_PROGRESS_STATUSES } from "@repo/shared";
import { screen } from "@testing-library/react";

import { renderWith } from "~/utils/testUtils";

import { LearningPathCoursesSection } from "./LearningPathCoursesSection";

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
  isLocked: false,
  completedAt: null,
};

const renderCourses = (showProgress: boolean) =>
  renderWith().render(
    <LearningPathCoursesSection
      availableCourseOptions={[]}
      pathCourses={[course]}
      isPending={false}
      canManage={false}
      canPlayCourses={false}
      showProgress={showProgress}
      onAddCourses={async () => {}}
      onReorderCourses={async () => {}}
      onRemoveCourse={async () => {}}
    />,
  );

describe("LearningPathCoursesSection", () => {
  it("shows course progress for learners", () => {
    renderCourses(true);

    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("hides course progress for the Group Manager view", () => {
    renderCourses(false);

    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
  });
});
