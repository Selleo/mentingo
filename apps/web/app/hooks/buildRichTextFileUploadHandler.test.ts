import { AUDIO_UPLOAD_MAX_BYTES, ENTITY_TYPES } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { insertResourceIntoEditor } from "~/components/RichText/utils/insertResourceIntoEditor";

import {
  buildRichTextFileUploadHandler,
  RICH_TEXT_ACCEPTED_FILE_TYPES,
  RICH_TEXT_LESSON_ACCEPTED_FILE_TYPES,
} from "./buildRichTextFileUploadHandler";

import type { Editor as TiptapEditor } from "@tiptap/react";

vi.mock("~/components/RichText/utils/insertResourceIntoEditor", () => ({
  insertResourceIntoEditor: vi.fn(),
}));

describe("buildRichTextFileUploadHandler", () => {
  it("advertises audio only in the lesson picker without raw AAC or wildcard codecs", () => {
    expect(RICH_TEXT_LESSON_ACCEPTED_FILE_TYPES).toContain("audio/mpeg");
    expect(RICH_TEXT_LESSON_ACCEPTED_FILE_TYPES).toContain(".m4a");
    expect(RICH_TEXT_LESSON_ACCEPTED_FILE_TYPES).not.toContain("audio/aac");
    expect(RICH_TEXT_LESSON_ACCEPTED_FILE_TYPES).not.toContain("audio/*");
    expect(RICH_TEXT_ACCEPTED_FILE_TYPES).not.toContain("audio/mpeg");
  });
  it.each([
    [ENTITY_TYPES.LESSON, "audio/mpeg", AUDIO_UPLOAD_MAX_BYTES + 1],
    [ENTITY_TYPES.LESSON, "audio/aac", 4],
    [ENTITY_TYPES.ARTICLES, "audio/mpeg", 4],
    [ENTITY_TYPES.NEWS, "audio/mpeg", 4],
  ])(
    "rejects unsupported audio scope/type/size before uploading (%s/%s/%s)",
    async (entityType, type, size) => {
      const uploadResourceFile = vi.fn();
      const onValidationError = vi.fn();
      const file = new File(["test"], "track.mp3", { type });
      Object.defineProperty(file, "size", { value: size });
      const handler = buildRichTextFileUploadHandler({
        entityType,
        getVideoSessionForFile: vi.fn(),
        uploadVideo: vi.fn(),
        uploadResourceFile,
        askForDisplayMode: vi.fn(),
        onVideoUploadError: vi.fn(),
        onValidationError,
        fallbackUploadErrorMessage: "Failed",
      });
      await handler(file);
      expect(uploadResourceFile).not.toHaveBeenCalled();
      expect(insertResourceIntoEditor).not.toHaveBeenCalled();
      expect(onValidationError).toHaveBeenCalledWith(expect.any(String));
    },
  );
  it("leaves the editor unchanged and marks the queue failed when the audio upload fails", async () => {
    const error = new Error("Storage unavailable");
    const setStatus = vi.fn();
    const handler = buildRichTextFileUploadHandler({
      entityType: ENTITY_TYPES.LESSON,
      getVideoSessionForFile: vi.fn(),
      uploadVideo: vi.fn(),
      uploadResourceFile: vi.fn().mockRejectedValue(error),
      askForDisplayMode: vi.fn(),
      onVideoUploadError: vi.fn(),
      fallbackUploadErrorMessage: "Failed",
      uploadQueue: {
        enqueue: vi.fn().mockReturnValue("queue-id"),
        setStatus,
        setProgress: vi.fn(),
        attachUploadId: vi.fn(),
      },
    });
    await expect(handler(new File(["test"], "track.mp3", { type: "audio/mpeg" }))).rejects.toThrow(
      error,
    );
    expect(insertResourceIntoEditor).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith("queue-id", "failed", {
      errorMessage: error.message,
    });
  });
  it.each([
    ["audio/mpeg", "track.mp3"],
    ["audio/x-mp3", "track.mp3"],
    ["audio/x-wav", "track.wav"],
    ["audio/x-m4a", "track.m4a"],
    ["application/ogg", "track.ogg"],
    ["audio/webm", "track.webm"],
    ["", "TRACK.MP3"],
    ["application/octet-stream", "track.opus"],
  ])("uploads %s audio through resources, inserting only after success", async (type, name) => {
    let finishUpload!: (id: string) => void;
    const uploadResourceFile = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const uploadVideo = vi.fn();
    const askForDisplayMode = vi.fn();
    const handler = buildRichTextFileUploadHandler({
      entityType: ENTITY_TYPES.LESSON,
      getVideoSessionForFile: vi.fn(),
      uploadVideo,
      uploadResourceFile,
      askForDisplayMode,
      onVideoUploadError: vi.fn(),
      fallbackUploadErrorMessage: "Failed",
    });
    const file = new File(["audio"], name, { type });
    const pending = handler(file, undefined, "private");
    expect(insertResourceIntoEditor).not.toHaveBeenCalled();
    finishUpload("audio-id");
    await pending;
    expect(uploadResourceFile).toHaveBeenCalledWith(file, "private");
    expect(insertResourceIntoEditor).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: "audio-id", resourceType: "audio", file }),
    );
    expect(uploadVideo).not.toHaveBeenCalled();
    expect(askForDisplayMode).not.toHaveBeenCalled();
  });
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
