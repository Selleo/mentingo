import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringBriefPanel } from "./AuthoringBriefPanel";
import { CourseGenerationInteraction } from "./CourseGenerationInteraction";

import type { CourseContext } from "../courseAuthoring.types";

const course: CourseContext = {
  courseId: "drop-course",
  language: "en",
  title: "Safety",
  description: "",
  baselineHash: "hash",
  fieldHashes: {},
  chapters: [],
};
const file = (name: string) => new File(["guide"], name, { type: "application/pdf" });
const transfer = (files: File[] = []) => ({ dataTransfer: { types: ["Files"], files } });

const setup = (onUploadSource = vi.fn().mockResolvedValue("source-1"), disabled = false) => {
  const onSelectSources = vi.fn();
  const view = (blocked: boolean) => (
    <CourseGenerationInteraction
      hasExistingContent={false}
      hasWork={false}
      activity={null}
      history={<p>Conversation history</p>}
      review={null}
      activityAndQuestions={null}
      composer={
        <AuthoringBriefPanel
          course={course}
          initialSourcePolicy={null}
          disabled={blocked}
          onSubmit={vi.fn()}
          onSelectSources={onSelectSources}
          onUploadSource={onUploadSource}
        />
      }
    />
  );
  return { ...renderWith().render(view(disabled)), onUploadSource, onSelectSources, view };
};

describe("course generation conversation file drop", () => {
  it("uploads multiple files dropped on the full-width conversation through the composer", async () => {
    const { onUploadSource, onSelectSources } = setup(vi.fn(async (file: File) => file.name));
    const area = screen.getByText("Conversation history").parentElement!;
    fireEvent.dragEnter(area, transfer());
    expect(screen.getByTestId("course-authoring-file-drop-overlay")).toHaveTextContent(
      "Attach files",
    );
    expect(screen.getByTestId("course-authoring-file-drop-overlay")).toHaveClass("bg-primary-50");
    expect(screen.getByRole("main")).not.toHaveClass("max-w-3xl");
    const files = [file("one.pdf"), file("two.pdf")];
    await act(async () => {
      fireEvent.drop(area, transfer(files));
    });
    expect(onUploadSource).toHaveBeenCalledTimes(2);
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceVersionIds: ["one.pdf", "two.pdf"] }),
    );
    expect(screen.getByTestId("course-authoring-composer-attachments")).toHaveTextContent(
      "two.pdf",
    );
  });

  it("keeps validation errors and successful siblings when a dropped batch contains invalid and failed files", async () => {
    const onUploadSource = vi.fn(async (file: File) => {
      if (file.name === "failed.pdf") throw new Error("Upload failed");
      return file.name;
    });
    const { onSelectSources } = setup(onUploadSource);
    await act(async () => {
      fireEvent.drop(
        screen.getByRole("main"),
        transfer([
          new File(["video"], "video.mp4", { type: "video/mp4" }),
          file("failed.pdf"),
          file("valid.pdf"),
        ]),
      );
    });
    expect(onUploadSource).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a PDF, DOCX, text, Markdown, PNG, JPEG or WebP file.",
    );
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceVersionIds: ["valid.pdf"] }),
    );
    expect(screen.getByTestId("course-authoring-composer-attachments")).toHaveTextContent(
      "valid.pdf",
    );
    expect(screen.queryByText("failed.pdf")).not.toBeInTheDocument();
  });

  it("ignores text drags without preventing native text editing", () => {
    const { onUploadSource } = setup();
    const area = screen.getByRole("main");
    const text = { dataTransfer: { types: ["text/plain"], files: [] } };
    expect(fireEvent.dragEnter(area, text)).toBe(true);
    expect(fireEvent.dragOver(area, text)).toBe(true);
    expect(fireEvent.drop(area, text)).toBe(true);
    expect(onUploadSource).not.toHaveBeenCalled();
    expect(screen.queryByTestId("course-authoring-file-drop-overlay")).not.toBeInTheDocument();
  });

  it("rejects file drops when discarded and clears feedback if disabled during a drag", () => {
    const { onUploadSource, rerender, view } = setup();
    const area = screen.getByRole("main");
    fireEvent.dragEnter(area, transfer());
    rerender(view(true));
    expect(screen.queryByTestId("course-authoring-file-drop-overlay")).not.toBeInTheDocument();
    expect(fireEvent.drop(area, transfer([file("guide.pdf")]))).toBe(false);
    expect(onUploadSource).not.toHaveBeenCalled();
    fireEvent.dragEnter(area, transfer());
    expect(screen.queryByTestId("course-authoring-file-drop-overlay")).not.toBeInTheDocument();
  });

  it("keeps pending dropped attachments removable without selecting them after upload", async () => {
    let resolveUpload!: (id: string) => void;
    const { onSelectSources } = setup(
      vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveUpload = resolve;
          }),
      ),
    );
    fireEvent.change(screen.getByTestId("course-authoring-brief-input"), {
      target: { value: "Use the guide" },
    });
    fireEvent.drop(screen.getByRole("main"), transfer([file("pending.pdf")]));
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove attachment pending.pdf" }));
    await act(async () => {
      resolveUpload("removed-source");
    });
    expect(onSelectSources).not.toHaveBeenCalled();
    expect(screen.queryByTestId("course-authoring-composer-attachments")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it.each(["leave", "dragend", "escape", "blur", "outside drop"])(
    "clears the drag feedback on %s without flickering over children",
    (cancel) => {
      setup();
      const area = screen.getByRole("main");
      const child = screen.getByText("Conversation history");
      fireEvent.dragEnter(area, transfer());
      fireEvent.dragEnter(child, transfer());
      fireEvent.dragLeave(child, { ...transfer(), relatedTarget: area });
      expect(screen.getByTestId("course-authoring-file-drop-overlay")).toBeInTheDocument();
      if (cancel === "leave")
        fireEvent.dragLeave(area, { ...transfer(), relatedTarget: document.body });
      if (cancel === "dragend") fireEvent.dragEnd(window);
      if (cancel === "escape") fireEvent.keyDown(window, { key: "Escape" });
      if (cancel === "blur") fireEvent.blur(window);
      if (cancel === "outside drop") fireEvent.drop(document.body, transfer());
      expect(screen.queryByTestId("course-authoring-file-drop-overlay")).not.toBeInTheDocument();
    },
  );
});
