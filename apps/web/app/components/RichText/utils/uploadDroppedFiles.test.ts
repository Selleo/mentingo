import { describe, expect, it, vi } from "vitest";

import { uploadDroppedFilesAtPosition } from "./uploadDroppedFiles";

import type { Editor as TiptapEditor } from "@tiptap/react";

describe("uploadDroppedFilesAtPosition", () => {
  it("advances the insertion position by the size of each inserted file node", async () => {
    const calls: string[] = [];
    let documentSize = 10;
    const editor = {
      commands: {
        setTextSelection: vi.fn((position: number) => calls.push(`position:${position}`)),
        focus: vi.fn(() => calls.push("focus")),
      },
      state: {
        doc: {
          content: {
            get size() {
              return documentSize;
            },
          },
        },
      },
    } as unknown as TiptapEditor;
    const files = [
      new File(["video"], "video.mp4", { type: "video/mp4" }),
      new File(["pdf"], "document.pdf", { type: "application/pdf" }),
    ];
    const onUpload = vi.fn(
      async (
        file?: File,
        _editor?: TiptapEditor | null,
        _visibility?: string,
        position?: number,
      ) => {
        calls.push(`upload:${file?.name}:${position}`);
        documentSize += file?.type === "video/mp4" ? 3 : 4;
      },
    );

    await uploadDroppedFilesAtPosition({
      editor,
      files,
      position: 7,
      visibility: "public",
      onUpload,
    });

    expect(editor.commands.setTextSelection).toHaveBeenNthCalledWith(1, 7);
    expect(editor.commands.setTextSelection).toHaveBeenNthCalledWith(2, 10);
    expect(onUpload).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      "position:7",
      "focus",
      "upload:video.mp4:7",
      "position:10",
      "focus",
      "upload:document.pdf:10",
      "focus",
    ]);
  });
});
