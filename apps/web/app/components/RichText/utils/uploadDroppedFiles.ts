import type { EditableResourceVisibility } from "@repo/shared";
import type { Editor as TiptapEditor } from "@tiptap/react";

type UploadDroppedFilesArgs = {
  editor: TiptapEditor | null;
  files: File[];
  position: number;
  visibility: EditableResourceVisibility;
  onUpload: (
    file?: File,
    editor?: TiptapEditor | null,
    visibility?: EditableResourceVisibility,
    position?: number,
  ) => Promise<void>;
};

export const uploadDroppedFilesAtPosition = async ({
  editor,
  files,
  position,
  visibility,
  onUpload,
}: UploadDroppedFilesArgs) => {
  let insertionPosition = position;

  editor?.commands.setTextSelection(insertionPosition);
  editor?.commands.focus();

  for (const [index, file] of files.entries()) {
    const documentSizeBeforeUpload = editor?.state.doc.content.size ?? 0;
    await onUpload(file, editor, visibility, insertionPosition);

    const documentSizeAfterUpload = editor?.state.doc.content.size ?? documentSizeBeforeUpload;
    insertionPosition += Math.max(0, documentSizeAfterUpload - documentSizeBeforeUpload);

    if (index < files.length - 1) {
      editor?.commands.setTextSelection(insertionPosition);
    }

    editor?.commands.focus();
  }
};
