import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type LoaderPlayNextProps = {
  seconds?: number | null;
  totalSeconds?: number | null;
  onPlayNext?: () => void;
  onCancel?: () => void;
  className?: string;
};

export const LoaderPlayNext = ({
  seconds,
  totalSeconds,
  onPlayNext,
  onCancel,
  className,
}: LoaderPlayNextProps) => {
  const { t } = useTranslation();
  const showCountdown = typeof seconds === "number";
  const showProgress =
    showCountdown && typeof totalSeconds === "number" && totalSeconds > 0 && seconds >= 0;
  const clampedSeconds = typeof seconds === "number" ? Math.max(0, seconds) : null;
  const progress = showProgress ? Math.min(1, Math.max(0, 1 - clampedSeconds! / totalSeconds!)) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      className={cn(
        "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-background text-foreground",
        className,
      )}
    >
      <div className="absolute inset-0 bg-primary-700/14" />
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0)_45%)]" />
      <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary-500/12 blur-3xl" />
      <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-primary-700/10 blur-3xl" />

      <div className="relative mx-5 flex w-full max-w-[560px] flex-col items-center gap-6 rounded-xl border border-primary-700/20 bg-background/80 px-6 py-7 text-center shadow-[0_16px_40px_rgba(0,0,0,0.2)] backdrop-blur-sm md:flex-row md:items-center md:justify-between md:text-left">
        <div className="flex items-center gap-5">
          <div className="relative grid size-28 shrink-0 place-items-center rounded-full bg-primary-700/12 ring-1 ring-primary-700/25">
            {showProgress ? (
              <svg
                className="size-24 -rotate-90 drop-shadow-[0_0_6px_rgba(53,114,255,0.28)]"
                viewBox="0 0 120 120"
                aria-hidden
              >
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="rgba(53,114,255,0.24)"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.35s ease-out" }}
                  className="text-primary-700"
                />
              </svg>
            ) : (
              <div className="size-24 rounded-full border-4 border-primary-700/25" />
            )}
            <div className="absolute flex flex-col items-center justify-center">
              <Icon name="Play" className="size-7 text-primary-700" />
              {showCountdown && (
                <span className="mt-1 text-lg font-bold tabular-nums text-primary-700">
                  {clampedSeconds}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xl font-semibold tracking-tight">
              {t("studentLessonView.playNext.title")}
            </span>
            <span className="text-sm text-foreground/80">
              {showCountdown
                ? t("studentLessonView.playNext.description", { seconds: clampedSeconds })
                : t("studentLessonView.playNext.descriptionNoCountdown")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onPlayNext && (
            <Button
              type="button"
              onClick={onPlayNext}
              aria-label={t("studentLessonView.playNext.playNow")}
              className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-contrast hover:bg-primary/90"
            >
              <Icon name="Play" className="mr-2 size-4" />
              {t("studentLessonView.playNext.playNow")}
            </Button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-primary-700/30 px-4 py-2 text-sm font-medium text-foreground/85 transition-colors hover:bg-primary-700/10 hover:text-foreground"
            >
              {t("studentLessonView.playNext.cancel")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
