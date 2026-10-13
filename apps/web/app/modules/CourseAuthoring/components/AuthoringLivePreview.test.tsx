import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringLivePreview } from "./AuthoringLivePreview";

import type { PreviewView } from "../courseAuthoring.types";

const preview: PreviewView = {
  id: "preview-1",
  taskId: "task-1",
  requestId: "request-1",
  revision: 2,
  status: "running",
  title: "Manager onboarding",
  lessonTitle: null,
  contentText: "Managers practice feedback with a realistic scenario.",
  outline: [
    {
      title: "Start well",
      lessons: [
        { title: "Set expectations", lessonType: "content" },
        { title: "Check understanding", lessonType: "quiz" },
      ],
    },
  ],
};

describe("AuthoringLivePreview", () => {
  it("shows the generating context, nested outline, and streamed content", () => {
    renderWith().render(<AuthoringLivePreview preview={preview} />);

    expect(screen.getByRole("region", { name: "Live preview" })).toBeInTheDocument();
    expect(screen.getByText("Generating")).toBeInTheDocument();
    expect(screen.getByText("Preview for Manager onboarding")).toBeInTheDocument();
    expect(screen.getByText("1. Start well")).toBeInTheDocument();
    expect(screen.getByText("1.1 Set expectations")).toBeInTheDocument();
    expect(screen.getByText("1.2 Check understanding")).toBeInTheDocument();
    expect(
      screen.getByText("Managers practice feedback with a realistic scenario."),
    ).toBeInTheDocument();
  });

  it("uses the lesson title when no course title is available", () => {
    renderWith().render(
      <AuthoringLivePreview
        preview={{
          ...preview,
          title: null,
          lessonTitle: "Feedback basics",
          outline: [],
          contentText: null,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Feedback basics" })).toBeInTheDocument();
  });

  it("shows the owning task as complete instead of leaving a stale generating state", () => {
    renderWith().render(<AuthoringLivePreview preview={{ ...preview, status: "succeeded" }} />);

    expect(screen.getByText("complete")).toBeInTheDocument();
    expect(screen.queryByText("Generating")).toBeNull();
  });

  it("offers a compact curriculum preview action when hosted in the drawer", async () => {
    const user = userEvent.setup();
    const onPreviewInCurriculum = vi.fn();
    renderWith().render(
      <AuthoringLivePreview preview={preview} onPreviewInCurriculum={onPreviewInCurriculum} />,
    );

    await user.click(screen.getByRole("button", { name: "Preview in curriculum" }));
    expect(onPreviewInCurriculum).toHaveBeenCalledOnce();
    expect(screen.queryByText("Course outline")).toBeNull();
  });
});
