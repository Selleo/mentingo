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

import {
  insertVideoUploadPlaceholder,
  updateVideoUploadNodeById,
} from "~/components/RichText/extensions/utils/videoUploadNode";
import {
  RICH_TEXT_RESOURCE_TYPE,
  buildEntityResourceUrl,
  insertResourceIntoEditor,
} from "~/hooks/useEntityResourceUpload";
import { UPLOAD_STATUS } from "~/hooks/useRichTextUploadQueue";

import type { Editor as TiptapEditor } from "@tiptap/react";
import type { InitVideoUploadResponse } from "~/api/generated-api";
import type { RichTextUploadKind, RichTextUploadStatus } from "~/hooks/useRichTextUploadQueue";

const DISPLAY_MODE = {
  PREVIEW: "preview",
  DOWNLOAD: "download",
} as const;

type DisplayMode = (typeof DISPLAY_MODE)[keyof typeof DISPLAY_MODE];

const createSerialQueue = () => {
  let tail = Promise.resolve();

  return <T>(task: () => Promise<T> | T) => {
    const next = tail.then(task, task);
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
};

const displayModePromptQueue = createSerialQueue();
const videoInsertQueue = createSerialQueue();

const askForDisplayModeSequentially = (
  askForDisplayMode: (filename: string) => Promise<DisplayMode | null>,
  filename: string,
) => {
  return displayModePromptQueue(() => askForDisplayMode(filename));
};

const insertPendingVideoNodeSequentially = async (args: {
  editor?: TiptapEditor | null;
  file: File;
  uploadId: string;
}) => {
  await videoInsertQueue(() =>
    insertVideoUploadPlaceholder({
      editor: args.editor,
      uploadId: args.uploadId,
      uploadLabel: args.file.name,
    }),
  );
};

const handleVideoUpload = async ({
  editor,
  file,
  entityType,
  getVideoSessionForFile,
  uploadVideo,
  onVideoUploadError,
  fallbackUploadErrorMessage,
  uploadQueue,
}: {
  editor?: TiptapEditor | null;
  file: File;
  entityType: EntityType;
  getVideoSessionForFile: (file: File) => Promise<InitVideoUploadResponse>;
  uploadVideo: (args: VideoUploadArgs) => Promise<void>;
  onVideoUploadError: (error: unknown) => void;
  fallbackUploadErrorMessage: string;
  uploadQueue?: BuildRichTextFileUploadHandlerArgs["uploadQueue"];
}) => {
  const queueId = uploadQueue?.enqueue({ fileName: file.name, kind: "video" });
  const uploadId = queueId ?? crypto.randomUUID();

  if (queueId) {
    uploadQueue?.setStatus(queueId, UPLOAD_STATUS.QUEUED);
  }

  await insertPendingVideoNodeSequentially({
    editor,
    file,
    uploadId,
  });

  try {
    const session = await getVideoSessionForFile(file);
    if (queueId) {
      uploadQueue?.attachUploadId(queueId, session.uploadId);
    }

    if (session.resourceId) {
      updateVideoUploadNodeById(editor, uploadId, {
        src: buildEntityResourceUrl(session.resourceId, entityType),
        sourceType: session.provider === "s3" ? "external" : "internal",
        provider: session.provider,
        hasError: false,
        uploadStatus: null,
        uploadErrorMessage: null,
      });
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
        updateVideoUploadNodeById(editor, uploadId, {
          hasError: true,
          uploadStatus: "failed",
          uploadErrorMessage: error.message,
        });
      },
    });
  } catch (error) {
    if (queueId) {
      uploadQueue?.setStatus(queueId, UPLOAD_STATUS.FAILED, {
        errorMessage: error instanceof Error ? error.message : fallbackUploadErrorMessage,
      });
    }
    updateVideoUploadNodeById(editor, uploadId, {
      uploadStatus: "failed",
      uploadErrorMessage: error instanceof Error ? error.message : fallbackUploadErrorMessage,
    });
    onVideoUploadError(error);
  }
};

const handleResourceUpload = async ({
  editor,
  file,
  entityType,
  resourceType,
  displayModePrompt,
  askForDisplayMode,
  uploadResourceFile,
  fallbackUploadErrorMessage,
  uploadQueue,
}: {
  editor?: TiptapEditor | null;
  file: File;
  entityType: EntityType;
  resourceType: RichTextResourceType;
  displayModePrompt: boolean;
  askForDisplayMode: (filename: string) => Promise<DisplayMode | null>;
  uploadResourceFile: (file: File) => Promise<string>;
  fallbackUploadErrorMessage: string;
  uploadQueue?: BuildRichTextFileUploadHandlerArgs["uploadQueue"];
}) => {
  const queueId = uploadQueue?.enqueue({ fileName: file.name, kind: "resource" });

  if (queueId) {
    uploadQueue?.setStatus(queueId, UPLOAD_STATUS.UPLOADING);
  }

  let displayMode: DisplayMode = DISPLAY_MODE.PREVIEW;

  if (displayModePrompt) {
    const selectedMode = await askForDisplayModeSequentially(askForDisplayMode, file.name);
    if (!selectedMode) {
      if (queueId) uploadQueue?.remove?.(queueId);
      return;
    }
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
    resourceType,
    displayMode,
  });
};

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
    remove?: (id: string) => void;
  };
};

type RichTextResourceType = (typeof RICH_TEXT_RESOURCE_TYPE)[keyof typeof RICH_TEXT_RESOURCE_TYPE];

type FileCharacteristics = {
  isVideo: boolean;
  isImage: boolean;
  isPresentation: boolean;
  isPdf: boolean;
  isDocument: boolean;
  resourceType: RichTextResourceType;
};

const getFileCharacteristics = (file: File): FileCharacteristics => {
  const isImage = ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_FILE_TYPES.includes(file.type);
  const isPresentation = ALLOWED_PRESENTATION_FILE_TYPES.includes(file.type);
  const isPdf = ALLOWED_PDF_FILE_TYPES.includes(file.type);
  const isDocument =
    isPdf ||
    ALLOWED_EXCEL_FILE_TYPES.includes(file.type) ||
    ALLOWED_WORD_FILE_TYPES.includes(file.type);

  return {
    isImage,
    isVideo,
    isPresentation,
    isPdf,
    isDocument,
    resourceType: match({
      isImage,
      isPresentation,
      isPdf,
      isDocument,
    })
      .with({ isImage: true }, () => RICH_TEXT_RESOURCE_TYPE.IMAGE)
      .with({ isPresentation: true }, () => RICH_TEXT_RESOURCE_TYPE.PRESENTATION)
      .with({ isPdf: true }, () => RICH_TEXT_RESOURCE_TYPE.PDF)
      .with({ isDocument: true }, () => RICH_TEXT_RESOURCE_TYPE.DOCUMENT)
      .otherwise(() => RICH_TEXT_RESOURCE_TYPE.OTHER),
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

    const { isVideo, isPresentation, isPdf, resourceType } = getFileCharacteristics(file);

    if (isVideo) {
      await handleVideoUpload({
        editor,
        file,
        entityType,
        getVideoSessionForFile,
        uploadVideo,
        onVideoUploadError,
        fallbackUploadErrorMessage,
        uploadQueue,
      });
      return;
    }

    await handleResourceUpload({
      editor,
      file,
      entityType,
      resourceType,
      displayModePrompt: isPresentation || isPdf,
      askForDisplayMode,
      uploadResourceFile,
      fallbackUploadErrorMessage,
      uploadQueue,
    });
  };
};
