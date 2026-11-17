import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LESSON_STATUS_TO_PROGRESS, ProgressBadge } from "~/components/Badges/ProgressBadge";
import { LESSON_PROGRESS_STATUSES } from "~/modules/Courses/Lesson/types";
import { renderWith } from "~/utils/testUtils";

import LessonStatusIcon from "./LessonStatusIcon";

describe("LessonStatusIcon", () => {
  it.each(Object.values(LESSON_PROGRESS_STATUSES))(
    "draws the same %s icon as the lesson sidebar badge",
    (status) => {
      const { container: tableOfContents } = renderWith().render(
        <LessonStatusIcon status={status} />,
      );
      const { container: sidebar } = renderWith().render(
        <ProgressBadge progress={LESSON_STATUS_TO_PROGRESS[status]} hideLabel />,
      );

      expect(sidebar.querySelector("svg")).not.toBeNull();
      expect(tableOfContents.querySelector("svg")?.outerHTML).toBe(
        sidebar.querySelector("svg")?.outerHTML,
      );
    },
  );

  it("labels a failed quiz with the shared status wording", () => {
    renderWith().render(<LessonStatusIcon status={LESSON_PROGRESS_STATUSES.FAILED} />);

    expect(screen.getAllByText("Failed")).toHaveLength(2);
    expect(screen.getAllByText("Failed")[0]).toHaveClass("sr-only");
  });
});
