import { screen } from "@testing-library/react";
import { default as userEventLib } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import LessonCard from "./LessonCard";

import type { Lesson } from "../../EditCourse.types";

const lesson: Lesson = {
  id: "lesson-1",
  updatedAt: "2026-01-01T00:00:00.000Z",
  type: "content",
  displayOrder: 1,
  title: "Draft lesson",
  description: "",
};

const renderLesson = (isPreviewLessonReady: boolean, onClickLessonCard: () => void) =>
  renderWith().render(
    <LessonCard
      item={lesson}
      onClickLessonCard={onClickLessonCard}
      dragTrigger={null}
      selectedLesson={null}
      isCourseGenerationLocked={false}
      isReadOnlyPreview
      isPreviewLessonReady={isPreviewLessonReady}
    />,
  );

describe("LessonCard read-only curriculum preview", () => {
  it("opens a generated lesson from keyboard activation", async () => {
    const user = userEventLib.setup();
    const onClickLessonCard = vi.fn();
    renderLesson(true, onClickLessonCard);

    await user.click(screen.getByRole("button", { name: "Lesson: Draft lesson" }));
    await user.keyboard("{Enter}");

    expect(onClickLessonCard).toHaveBeenCalledTimes(2);
  });

  it("keeps an outline-only lesson disabled for pointer and keyboard input", async () => {
    const user = userEventLib.setup();
    const onClickLessonCard = vi.fn();
    renderLesson(false, onClickLessonCard);
    const card = screen.getByTestId("curriculum-lesson-card-lesson-1");
    const tooltipTrigger = screen.getByLabelText(/content for this lesson|treść tej lekcji/i);

    await user.click(card);
    card.focus();
    await user.keyboard("{Enter}");
    await user.hover(tooltipTrigger);

    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(onClickLessonCard).not.toHaveBeenCalled();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /content for this lesson|treść tej lekcji/i,
    );

    await user.unhover(tooltipTrigger);
    tooltipTrigger.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /content for this lesson|treść tej lekcji/i,
    );
  });
});
