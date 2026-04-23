import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import { CircularProgress } from "~/components/ui/circular-progress";
import { Progress } from "~/components/ui/progress";
import { ACTIVE_UPLOAD_STATUSES, UPLOAD_STATUS } from "~/hooks/useRichTextUploadQueue";
import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../e2e/data/common/handles";

import type { RichTextUploadQueueItem, RichTextUploadStatus } from "~/hooks/useRichTextUploadQueue";

type RichTextUploadQueueProps = {
  items: RichTextUploadQueueItem[];
  onClearFinished: () => void;
  onRemoveItem: (id: string) => void;
};

const statusMeta = {
  [UPLOAD_STATUS.QUEUED]: { label: "Queued", icon: Clock3, colorClass: "text-neutral-600" },
  [UPLOAD_STATUS.UPLOADING]: {
    label: "Uploading",
    icon: Loader2,
    colorClass: "text-primary-700",
  },
  [UPLOAD_STATUS.PROCESSING]: {
    label: "Processing",
    icon: Loader2,
    colorClass: "text-secondary-700",
  },
  [UPLOAD_STATUS.SUCCESS]: { label: "Done", icon: CheckCircle2, colorClass: "text-success-700" },
  [UPLOAD_STATUS.FAILED]: { label: "Failed", icon: XCircle, colorClass: "text-error-700" },
} satisfies Record<
  RichTextUploadStatus,
  { label: string; icon: typeof CheckCircle2; colorClass: string }
>;

const getItemProgress = (status: RichTextUploadStatus, progress: number | null) =>
  match(status)
    .with(UPLOAD_STATUS.QUEUED, () => 0)
    .with(UPLOAD_STATUS.SUCCESS, () => 100)
    .with(UPLOAD_STATUS.FAILED, () => 0)
    .with(UPLOAD_STATUS.PROCESSING, () => 100)
    .otherwise(() => progress ?? 0);

export const RichTextUploadQueue = ({
  items,
  onClearFinished,
  onRemoveItem,
}: RichTextUploadQueueProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeItems = useMemo(
    () => items.filter((item) => ACTIVE_UPLOAD_STATUSES.includes(item.status)),
    [items],
  );

  const hasFinished = useMemo(
    () =>
      items.some(
        (item) => item.status === UPLOAD_STATUS.SUCCESS || item.status === UPLOAD_STATUS.FAILED,
      ),
    [items],
  );

  const overallProgress = useMemo(() => {
    if (!activeItems.length) return 100;

    const total = activeItems.reduce(
      (sum, item) => sum + getItemProgress(item.status, item.progress),
      0,
    );

    return Math.round(total / activeItems.length);
  }, [activeItems]);

  if (!items.length) return null;

  return (
    <section
      data-testid={RICH_TEXT_HANDLES.UPLOAD_QUEUE}
      className="pointer-events-auto w-full overflow-hidden rounded-xl border border-neutral-200 bg-white"
      aria-label="Upload queue"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white px-4 py-3 text-left"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-3">
          <CircularProgress
            value={overallProgress}
            size={52}
            circleStrokeWidth={4}
            progressStrokeWidth={4}
            showLabel
            renderLabel={(value) => `${value}%`}
            labelClassName="text-sm font-semibold text-neutral-800"
          />
          <div>
            <p className="text-lg font-semibold text-neutral-950">Uploads</p>
            <p className="text-sm text-neutral-600">
              {activeItems.length ? `${activeItems.length} active` : `${items.length} completed`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasFinished && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
              onClick={(event) => {
                event.stopPropagation();
                onClearFinished();
              }}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Clear
            </Button>
          )}
          <span className="rounded-md p-1.5 text-neutral-600">
            {isExpanded ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="max-h-[360px] space-y-2.5 overflow-y-auto bg-neutral-50/60 p-3">
          {items.map(({ status, id, progress, errorMessage, fileName }) => {
            const { icon: StatusIcon, label, colorClass } = statusMeta[status];
            const isActive = ACTIVE_UPLOAD_STATUSES.includes(status);
            const isAnimated =
              status === UPLOAD_STATUS.UPLOADING || status === UPLOAD_STATUS.PROCESSING;
            const showProgress =
              status === UPLOAD_STATUS.UPLOADING || status === UPLOAD_STATUS.QUEUED;
            const itemProgress = getItemProgress(status, progress);

            return (
              <article
                key={id}
                data-testid={RICH_TEXT_HANDLES.uploadQueueItem(fileName)}
                className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3 shadow-[0_2px_10px_-8px_rgba(15,23,42,0.5)]"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{fileName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusIcon
                        className={cn("size-4", colorClass, isAnimated && "animate-spin")}
                      />
                      <p className={cn("text-xs font-medium", colorClass)}>
                        {label}
                        {status === UPLOAD_STATUS.UPLOADING && progress !== null
                          ? ` (${progress}%)`
                          : ""}
                      </p>
                    </div>
                    {errorMessage && <p className="mt-1 text-xs text-error-700">{errorMessage}</p>}
                  </div>

                  {isActive ? (
                    <CircularProgress
                      value={itemProgress}
                      size={34}
                      circleStrokeWidth={3}
                      progressStrokeWidth={3}
                      className="self-center"
                      showLabel={status === UPLOAD_STATUS.UPLOADING}
                      renderLabel={(value) => `${value}`}
                      labelClassName="text-[10px] font-semibold text-neutral-700"
                    />
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 self-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                      onClick={() => onRemoveItem(id)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>

                {showProgress && (
                  <div className="mt-2.5">
                    <Progress value={itemProgress} className="h-1.5" />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
