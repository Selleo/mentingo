import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseMediaModal from "./CourseMediaModal";

describe("CourseMediaModal", () => {
  it("closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWith().render(
      <CourseMediaModal
        heroImagePositionDraft={50}
        imageInputRef={createRef<HTMLInputElement>()}
        imagePreviewUrl="/course-image.jpg"
        isSaving={false}
        onClose={onClose}
        onImageSelection={vi.fn()}
        onPositionChange={vi.fn()}
        onSave={vi.fn()}
        onTrailerSelection={vi.fn()}
        selectedTrailerFile={null}
        trailerInputRef={createRef<HTMLInputElement>()}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("lets an administrator select a hero image", async () => {
    const user = userEvent.setup();
    const onImageSelection = vi.fn();
    const imageInputRef = createRef<HTMLInputElement>();

    renderWith().render(
      <CourseMediaModal
        heroImagePositionDraft={50}
        imageInputRef={imageInputRef}
        imagePreviewUrl="/course-image.jpg"
        isSaving={false}
        onClose={vi.fn()}
        onImageSelection={onImageSelection}
        onPositionChange={vi.fn()}
        onSave={vi.fn()}
        onTrailerSelection={vi.fn()}
        selectedTrailerFile={null}
        trailerInputRef={createRef<HTMLInputElement>()}
      />,
    );

    const image = new File(["image"], "course-hero.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload new hero image"), image);

    expect(onImageSelection).toHaveBeenCalledOnce();
    expect(onImageSelection).toHaveBeenCalledWith(image);
    expect(imageInputRef.current?.files?.[0]).toBe(image);
  });

  it("lets an administrator select a course trailer", async () => {
    const user = userEvent.setup();
    const onTrailerSelection = vi.fn();
    const trailerInputRef = createRef<HTMLInputElement>();

    renderWith().render(
      <CourseMediaModal
        heroImagePositionDraft={50}
        imageInputRef={createRef<HTMLInputElement>()}
        imagePreviewUrl="/course-image.jpg"
        isSaving={false}
        onClose={vi.fn()}
        onImageSelection={vi.fn()}
        onPositionChange={vi.fn()}
        onSave={vi.fn()}
        onTrailerSelection={onTrailerSelection}
        selectedTrailerFile={null}
        trailerInputRef={trailerInputRef}
      />,
    );

    const trailer = new File(["video"], "course-trailer.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText("Course trailer (optional)"), trailer);

    expect(onTrailerSelection).toHaveBeenCalledOnce();
    expect(onTrailerSelection).toHaveBeenCalledWith(trailer);
    expect(trailerInputRef.current?.files?.[0]).toBe(trailer);
  });
});
