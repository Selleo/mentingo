import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  type EntityType,
} from "@repo/shared";
import { match } from "ts-pattern";

import { buildEntityResourceUrl, insertResourceIntoEditor } from "~/hooks/useEntityResourceUpload";
import { UPLOAD_STATUS } from "~/hooks/useRichTextUploadQueue";

import type { Editor as TiptapEditor } from "@tiptap/react";
import type { InitVideoUploadResponse } from "~/api/generated-api";
import type { RichTextUploadKind, RichTextUploadStatus } from "~/hooks/useRichTextUploadQueue";

const DISPLAY_MODE = {
  PREVIEW: "preview",
  DOWNLOAD: "download",
} as const;

type DisplayMode = (typeof DISPLAY_MODE)[keyof typeof DISPLAY_MODE];

type VideoUploadArgs = {
  file: File;
  session: InitVideoUploadResponse;
  onUploadingStart?: () => void;
  onProgress?: (progress: number) => void;
  onUploaded?: () => void;
  onError?: (error: Error) => void;
};

type BuildRichTextFileUploadHandlerArgs = {
  entityType: EntityType;
  getVideoSessionForFile: (file: File) => Promise<InitVideoUploadResponse>;
  uploadVideo: (args: VideoUploadArgs) => Promise<void>;
  uploadResourceFile: (file: File) => Promise<string>;
  askForDisplayMode: (filename: string) => Promise<DisplayMode | null>;
  onVideoUploadError: (error: unknown) => void;
  fallbackUploadErrorMessage: string;
  uploadQueue?: {
    enqueue: (args: { fileName: string; kind: RichTextUploadKind }) => string;
    setStatus: (
      id: string,
      status: RichTextUploadStatus,
      options?: { errorMessage?: string },
    ) => void;
    setProgress: (id: string, progress: number) => void;
    attachUploadId: (id: string, uploadId: string) => void;
  };
};

export const RICH_TEXT_ACCEPTED_FILE_TYPES = [
  ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ...ALLOWED_VIDEO_FILE_TYPES,
  ...ALLOWED_EXCEL_FILE_TYPES,
  ...ALLOWED_PDF_FILE_TYPES,
  ...ALLOWED_WORD_FILE_TYPES,
  ...ALLOWED_PRESENTATION_FILE_TYPES,
] as const;

const removeVideoEmbedBySource = (editor: TiptapEditor, src: string) => {
  editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      let found = false;

      state.doc.descendants((node, pos) => {
        if (node.type.name !== "video") return true;
        if (node.attrs.src !== src) return true;

        tr.delete(pos, pos + node.nodeSize);
        found = true;
        return false;
      });

      if (!found) return false;

      dispatch?.(tr);
      return true;
    })
    .run();
};

export const buildRichTextFileUploadHandler = ({
  entityType,
  getVideoSessionForFile,
  uploadVideo,
  uploadResourceFile,
  askForDisplayMode,
  onVideoUploadError,
  fallbackUploadErrorMessage,
  uploadQueue,
}: BuildRichTextFileUploadHandlerArgs) => {
  return async (file?: File, editor?: TiptapEditor | null) => {
    if (!file) return;

    const isVideo = ALLOWED_VIDEO_FILE_TYPES.includes(file.type);
    const isPresentation = ALLOWED_PRESENTATION_FILE_TYPES.includes(file.type);
    const isPdf = ALLOWED_PDF_FILE_TYPES.includes(file.type);
    const isDocument =
      isPdf ||
      ALLOWED_EXCEL_FILE_TYPES.includes(file.type) ||
      ALLOWED_WORD_FILE_TYPES.includes(file.type);

    if (isVideo) {
      let insertedResourceUrl: string | null = null;
      const queueId = uploadQueue?.enqueue({ fileName: file.name, kind: "video" });
      if (queueId) {
        uploadQueue?.setStatus(queueId, UPLOAD_STATUS.QUEUED);
      }

      try {
        const session = await getVideoSessionForFile(file);
        if (queueId) {
          uploadQueue?.attachUploadId(queueId, session.uploadId);
        }

        if (session.resourceId && editor) {
          insertedResourceUrl = buildEntityResourceUrl(session.resourceId, entityType);

          editor
            .chain()
            .focus()
            .setVideoEmbed({
              src: insertedResourceUrl,
              sourceType: session.provider === "s3" ? "external" : "internal",
            })
            .run();
        }

        await uploadVideo({
          file,
          session,
          onUploadingStart: () => {
            if (queueId) uploadQueue?.setStatus(queueId, UPLOAD_STATUS.UPLOADING);
          },
          onProgress: (progress) => {
            if (queueId) uploadQueue?.setProgress(queueId, progress);
          },
          onUploaded: () => {
            if (queueId) uploadQueue?.setStatus(queueId, UPLOAD_STATUS.SUCCESS);
          },
          onError: (error) => {
            if (queueId) {
              uploadQueue?.setStatus(queueId, UPLOAD_STATUS.FAILED, {
                errorMessage: error.message,
              });
            }
          },
        });
      } catch (error) {
        if (editor && insertedResourceUrl) {
          removeVideoEmbedBySource(editor, insertedResourceUrl);
        }
        if (queueId) {
          uploadQueue?.setStatus(queueId, UPLOAD_STATUS.FAILED, {
            errorMessage: error instanceof Error ? error.message : fallbackUploadErrorMessage,
          });
        }
        onVideoUploadError(error);
      }
      return;
    }

    const queueId = uploadQueue?.enqueue({ fileName: file.name, kind: "resource" });

    if (queueId) {
      uploadQueue?.setStatus(queueId, UPLOAD_STATUS.UPLOADING);
    }

    let displayMode: DisplayMode = DISPLAY_MODE.PREVIEW;

    if (isPresentation || isPdf) {
      const selectedMode = await askForDisplayMode(file.name);
      if (!selectedMode) return;
      displayMode = selectedMode;
    }

    let resourceId: string;
    try {
      resourceId = await uploadResourceFile(file);

      if (queueId) {
        uploadQueue?.setProgress(queueId, 100);
        uploadQueue?.setStatus(queueId, UPLOAD_STATUS.SUCCESS);
      }
    } catch (error) {
      if (queueId) {
        uploadQueue?.setStatus(queueId, UPLOAD_STATUS.FAILED, {
          errorMessage: error instanceof Error ? error.message : fallbackUploadErrorMessage,
        });
      }
      throw error;
    }

    insertResourceIntoEditor({
      editor,
      resourceId,
      entityType,
      file,
      resourceType: match({ isPresentation, isPdf, isDocument })
        .with({ isPresentation: true }, () => "presentation" as const)
        .with({ isPdf: true }, () => "pdf" as const)
        .with({ isDocument: true }, () => "document" as const)
        .otherwise(() => "other" as const),
      displayMode: isPresentation || isDocument ? displayMode : DISPLAY_MODE.PREVIEW,
    });
  };
};
