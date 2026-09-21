import { ENTITY_TYPES } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { insertResourceIntoEditor } from "~/components/RichText/utils/insertResourceIntoEditor";

import { buildRichTextFileUploadHandler } from "./buildRichTextFileUploadHandler";

import type { Editor as TiptapEditor } from "@tiptap/react";

vi.mock("~/components/RichText/utils/insertResourceIntoEditor", () => ({
  insertResourceIntoEditor: vi.fn(),
}));

describe("buildRichTextFileUploadHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores the batch position after the PDF display-mode dialog", async () => {
    const setTextSelection = vi.fn();
    const editor = { commands: { setTextSelection } } as unknown as TiptapEditor;
    const askForDisplayMode = vi.fn().mockResolvedValue("preview");
    const handler = buildRichTextFileUploadHandler({
      entityType: ENTITY_TYPES.LESSON,
      getVideoSessionForFile: vi.fn(),
      uploadVideo: vi.fn(),
      uploadResourceFile: vi.fn().mockResolvedValue("resource-id"),
      askForDisplayMode,
      onVideoUploadError: vi.fn(),
      fallbackUploadErrorMessage: "Upload failed",
    });

    await handler(
      new File(["pdf"], "document.pdf", { type: "application/pdf" }),
      editor,
      "public",
      12,
    );

    expect(askForDisplayMode).toHaveBeenCalledWith("document.pdf");
    expect(setTextSelection).toHaveBeenCalledWith(12);
    expect(insertResourceIntoEditor).toHaveBeenCalledOnce();
    expect(setTextSelection.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(insertResourceIntoEditor).mock.invocationCallOrder[0],
    );
  });
});
