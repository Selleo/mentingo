import { VIDEO_UPLOAD_STATUS } from "@repo/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { match } from "ts-pattern";

import { subscribeVideoUploadStatusEvent } from "~/hooks/videoUploadStatusBus";

export const UPLOAD_STATUS = {
  QUEUED: VIDEO_UPLOAD_STATUS.QUEUED,
  UPLOADING: "uploading",
  PROCESSING: VIDEO_UPLOAD_STATUS.UPLOADED,
  SUCCESS: VIDEO_UPLOAD_STATUS.PROCESSED,
  FAILED: VIDEO_UPLOAD_STATUS.FAILED,
} as const;

export const ACTIVE_UPLOAD_STATUSES: readonly RichTextUploadStatus[] = [
  UPLOAD_STATUS.QUEUED,
  UPLOAD_STATUS.UPLOADING,
  UPLOAD_STATUS.PROCESSING,
];

export type RichTextUploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS];

export type RichTextUploadKind = "video" | "resource";

export type RichTextUploadQueueItem = {
  id: string;
  fileName: string;
  kind: RichTextUploadKind;
  status: RichTextUploadStatus;
  progress: number | null;
  uploadId?: string;
  errorMessage?: string;
  createdAt: number;
};

type EnqueueArgs = {
  fileName: string;
  kind: RichTextUploadKind;
};

type QueueState = {
  items: RichTextUploadQueueItem[];
};

type QueueListener = (state: QueueState) => void;

let queueState: QueueState = { items: [] };
const queueListeners: QueueListener[] = [];
let statusBusUnsubscribe: (() => void) | null = null;

const setQueueState = (updater: (prev: QueueState) => QueueState) => {
  queueState = updater(queueState);
  queueListeners.forEach((listener) => listener(queueState));
};

const ensureStatusBusSubscription = () => {
  if (statusBusUnsubscribe) return;

  statusBusUnsubscribe = subscribeVideoUploadStatusEvent((event) => {
    setQueueState((prevState) => ({
      ...prevState,
      items: prevState.items.map((item) => {
        if (item.uploadId !== event.uploadId) return item;

        if (event.status === VIDEO_UPLOAD_STATUS.PROCESSED) {
          return { ...item, status: UPLOAD_STATUS.SUCCESS, progress: 100 };
        }

        if (event.status === VIDEO_UPLOAD_STATUS.FAILED) {
          return {
            ...item,
            status: UPLOAD_STATUS.FAILED,
            progress: 0,
            errorMessage: event.error ?? "Upload failed",
          };
        }

        if (event.status === VIDEO_UPLOAD_STATUS.UPLOADED) {
          return { ...item, status: UPLOAD_STATUS.SUCCESS, progress: 100 };
        }

        return item;
      }),
    }));
  });
};

export const useRichTextUploadQueue = () => {
  const [state, setState] = useState<QueueState>(queueState);

  useEffect(() => {
    ensureStatusBusSubscription();

    queueListeners.push(setState);

    return () => {
      const index = queueListeners.indexOf(setState);

      if (index > -1) queueListeners.splice(index, 1);
    };
  }, []);

  const enqueue = useCallback(({ fileName, kind }: EnqueueArgs) => {
    const id = crypto.randomUUID();

    setQueueState((prevState) => ({
      ...prevState,
      items: [
        {
          id,
          fileName,
          kind,
          status: UPLOAD_STATUS.QUEUED,
          progress: 0,
          createdAt: Date.now(),
        },
        ...prevState.items,
      ],
    }));

    return id;
  }, []);

  const setStatus = useCallback(
    (id: string, status: RichTextUploadStatus, options?: { errorMessage?: string }) => {
      setQueueState((prevState) => ({
        ...prevState,
        items: prevState.items.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                errorMessage: options?.errorMessage,
                progress: match(status)
                  .with(UPLOAD_STATUS.QUEUED, () => 0)
                  .with(UPLOAD_STATUS.SUCCESS, () => 100)
                  .with(UPLOAD_STATUS.FAILED, () => 0)
                  .otherwise(() => item.progress),
              }
            : item,
        ),
      }));
    },
    [],
  );

  const setProgress = useCallback((id: string, progress: number) => {
    setQueueState((prevState) => ({
      ...prevState,
      items: prevState.items.map((item) =>
        item.id === id
          ? {
              ...item,
              progress,
              status: item.status === UPLOAD_STATUS.QUEUED ? UPLOAD_STATUS.UPLOADING : item.status,
            }
          : item,
      ),
    }));
  }, []);

  const attachUploadId = useCallback((id: string, uploadId: string) => {
    setQueueState((prevState) => ({
      ...prevState,
      items: prevState.items.map((item) =>
        item.id === id
          ? {
              ...item,
              uploadId,
            }
          : item,
      ),
    }));
  }, []);

  const clearFinished = useCallback(() => {
    setQueueState((prevState) => ({
      ...prevState,
      items: prevState.items.filter(
        (item) => item.status !== UPLOAD_STATUS.SUCCESS && item.status !== UPLOAD_STATUS.FAILED,
      ),
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setQueueState((prevState) => ({
      ...prevState,
      items: prevState.items.filter((item) => item.id !== id),
    }));
  }, []);

  const hasActiveUploads = useMemo(
    () => state.items.some((item) => ACTIVE_UPLOAD_STATUSES.includes(item.status)),
    [state.items],
  );

  return {
    items: state.items,
    enqueue,
    setStatus,
    setProgress,
    attachUploadId,
    clearFinished,
    remove,
    hasActiveUploads,
  };
};

export type RichTextUploadQueueController = ReturnType<typeof useRichTextUploadQueue>;
