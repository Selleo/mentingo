import { VIDEO_AUTOPLAY } from "@repo/shared";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

import type { Editor as TiptapEditor } from "@tiptap/react";

export const VIDEO_UPLOAD_NODE_STATUS = {
  UPLOADING: "uploading",
  FAILED: "failed",
} as const;

export type VideoUploadNodeStatus =
  (typeof VIDEO_UPLOAD_NODE_STATUS)[keyof typeof VIDEO_UPLOAD_NODE_STATUS];

export type VideoUploadNodeAttrs = {
  uploadId: string | null;
  uploadLabel: string | null;
  uploadStatus: VideoUploadNodeStatus | null;
  uploadErrorMessage: string | null;
};

type VideoUploadNodeAttrsInput = Partial<VideoUploadNodeAttrs>;

type VideoUploadNodeMatch = {
  pos: number;
  node: {
    attrs: Record<string, unknown>;
    nodeSize: number;
  };
};

export const normalizeVideoUploadNodeAttrs = (
  attrs: VideoUploadNodeAttrsInput,
): VideoUploadNodeAttrs => ({
  uploadId: typeof attrs.uploadId === "string" ? attrs.uploadId : null,
  uploadLabel: typeof attrs.uploadLabel === "string" ? attrs.uploadLabel : null,
  uploadStatus:
    attrs.uploadStatus === VIDEO_UPLOAD_NODE_STATUS.UPLOADING ||
    attrs.uploadStatus === VIDEO_UPLOAD_NODE_STATUS.FAILED
      ? attrs.uploadStatus
      : null,
  uploadErrorMessage:
    typeof attrs.uploadErrorMessage === "string" ? attrs.uploadErrorMessage : null,
});

export const getVideoUploadNodeDataAttributes = (attrs: VideoUploadNodeAttrs) => ({
  "data-upload-id": attrs.uploadId ?? "",
  "data-upload-label": attrs.uploadLabel ?? "",
  "data-upload-status": attrs.uploadStatus ?? "",
  "data-upload-error-message": attrs.uploadErrorMessage ?? "",
});

const findVideoUploadNode = (
  editor: TiptapEditor,
  uploadId: string,
): VideoUploadNodeMatch | null => {
  let match: VideoUploadNodeMatch | null = null;

  editor.state.doc.descendants((node, pos) => {
    if ((node.attrs as { uploadId?: unknown }).uploadId !== uploadId) return true;

    match = {
      pos,
      node: {
        attrs: node.attrs as Record<string, unknown>,
        nodeSize: node.nodeSize,
      },
    };
    return false;
  });

  return match;
};

export const updateVideoUploadNodeById = (
  editor: TiptapEditor | null | undefined,
  uploadId: string | null | undefined,
  attrs: Partial<VideoUploadNodeAttrs> & Record<string, unknown>,
) => {
  if (!editor || !uploadId) return false;

  const match = findVideoUploadNode(editor, uploadId);
  if (!match) return false;

  const nextAttrs = {
    ...match.node.attrs,
    ...attrs,
    uploadId,
  };

  editor.view.dispatch(editor.state.tr.setNodeMarkup(match.pos, undefined, nextAttrs));
  return true;
};

export const removeVideoUploadNodeById = (
  editor: TiptapEditor | null | undefined,
  uploadId: string | null | undefined,
) => {
  if (!editor || !uploadId) return false;

  const match = findVideoUploadNode(editor, uploadId);
  if (!match) return false;

  editor.view.dispatch(editor.state.tr.delete(match.pos, match.pos + match.node.nodeSize));
  return true;
};

export const insertVideoUploadPlaceholder = ({
  editor,
  uploadId,
  uploadLabel,
}: {
  editor?: TiptapEditor | null;
  uploadId: string;
  uploadLabel: string;
}) => {
  if (!editor) return;

  editor
    .chain()
    .focus()
    .insertContent({
      type: "video",
      attrs: {
        src: null,
        uploadId,
        uploadLabel,
        uploadStatus: VIDEO_UPLOAD_NODE_STATUS.UPLOADING,
        uploadErrorMessage: null,
        sourceType: "external",
        provider: "unknown",
        hasError: false,
        autoplay: VIDEO_AUTOPLAY.NO_AUTOPLAY,
        index: null,
      },
    })
    .run();

  const { state, view } = editor;
  const { selection } = state;
  const targetPos = selection instanceof NodeSelection ? selection.to + 1 : selection.to;
  const clampedPos = Math.max(1, Math.min(targetPos, state.doc.content.size));
  const nextSelection = TextSelection.create(state.doc, clampedPos);

  view.dispatch(state.tr.setSelection(nextSelection).scrollIntoView());
};
