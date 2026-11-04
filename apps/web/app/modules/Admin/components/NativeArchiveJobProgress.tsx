import { useTranslation } from "react-i18next";

import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

import type { NativeArchiveJobProgress as NativeArchiveJobProgressValue } from "~/api/mutations/admin/nativeArchive.types";

type NativeArchiveProgressBarProps = {
  label: string;
  percent: number;
  className?: string;
};

/** A labelled bar that glides across one status poll (NATIVE_ARCHIVE_STATUS_POLL_MS) instead of jumping. */
export function NativeArchiveProgressBar({
  label,
  percent,
  className,
}: NativeArchiveProgressBarProps) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)} role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs text-neutral-600">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <Progress
        value={percent}
        aria-label={label}
        className="h-1.5"
        indicatorClassName="duration-[2000ms] ease-linear"
      />
    </div>
  );
}

type NativeArchiveJobProgressProps = {
  progress: NativeArchiveJobProgressValue | null | undefined;
  className?: string;
};

/** Shows what a running export, import, or marketplace copy is doing and how far it is. */
export function NativeArchiveJobProgress({ progress, className }: NativeArchiveJobProgressProps) {
  const { t } = useTranslation();

  return (
    <NativeArchiveProgressBar
      className={className}
      percent={progress?.percent ?? 0}
      label={
        progress
          ? t(`nativeArchive.progress.stages.${progress.stage}`)
          : t("nativeArchive.progress.waiting")
      }
    />
  );
}
