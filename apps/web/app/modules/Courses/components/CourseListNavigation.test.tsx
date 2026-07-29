import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseCard from "./CourseCard";
import ModernCourseCard from "./modern/ModernCourseCard";

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAccess: false }),
}));

describe("course list navigation", () => {
  it("opens the course overview from an unenrolled legacy course card", () => {
    renderWith().render(
      <MemoryRouter>
        <CourseCard
          id="legacy-course"
          slug="legacy-course-slug"
          title="Legacy course"
          description="Legacy course description"
          category="Development"
          author="Course author"
          authorAvatarUrl={null}
          currency="USD"
          priceInCents={0}
          enrolled={false}
          enrolledParticipantCount={0}
          completedChapterCount={0}
          courseChapterCount={2}
          dueDate={null}
          thumbnailUrl={null}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("Legacy course")).toHaveAttribute(
      "href",
      "/course/legacy-course-slug",
    );
    expect(screen.getByRole("button", { name: "Enroll" })).toBeVisible();
  });

  it("opens the course overview from an unenrolled modern course card", () => {
    renderWith().render(
      <MemoryRouter>
        <ModernCourseCard
          id="modern-course"
          title="Modern course"
          description="Modern course description"
          category="Development"
          enrolled={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("modern-course-card-link")).toHaveAttribute(
      "href",
      "/course/modern-course",
    );
  });
});
