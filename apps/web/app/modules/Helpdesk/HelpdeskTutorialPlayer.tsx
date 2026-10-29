import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { Check, Clock3, ListVideo, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { VideoPlayer } from "~/components/VideoPlayer/VideoPlayer";
import { cn } from "~/lib/utils";

import { formatHelpdeskTime, HELPDESK_DOMAIN_LABELS } from "./helpdesk.helpers";

import type { HelpdeskTutorial } from "./helpdesk.types";

type Props = { tutorial: HelpdeskTutorial; startMs: number; showChapterTimeline?: boolean };

export function HelpdeskTutorialPlayer({ tutorial, startMs, showChapterTimeline = true }: Props) {
  const { t } = useTranslation();
  const initialMs = Math.min(Math.max(startMs, 0), tutorial.durationMs);
  const [seek, setSeek] = useState({ seconds: initialMs / 1000, id: 0 });
  const [currentTimeMs, setCurrentTimeMs] = useState(initialMs);
  const reportTime = useCallback((seconds: number) => setCurrentTimeMs(seconds * 1000), []);
  const activeChapter = tutorial.chapters.find(
    (chapter) => chapter.startMs <= currentTimeMs && currentTimeMs < chapter.endMs,
  );
  const seekChapter = (nextStartMs: number) => {
    setCurrentTimeMs(nextStartMs);
    setSeek((previous) => ({ seconds: nextStartMs / 1000, id: previous.id + 1 }));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-6 pb-4 text-xs font-medium text-primary-700">
        <span>{t(HELPDESK_DOMAIN_LABELS[tutorial.domain])}</span>
        <span aria-hidden>·</span>
        <Clock3 className="size-3" aria-hidden />
        <span>{formatHelpdeskTime(tutorial.durationMs / 1000)}</span>
        {tutorial.languageFallback && (
          <span className="text-neutral-500">
            {t("helpdesk.languageFallback", { language: tutorial.language })}
          </span>
        )}
      </div>
      <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 bg-neutral-950">
          <div className="relative aspect-video w-full">
            <VideoPlayer
              url={tutorial.videoUrl}
              poster={tutorial.posterUrl}
              provider={VIDEO_EMBED_PROVIDERS.BUNNY}
              fill
              autoPlay={false}
              seekTo={seek.seconds}
              seekRequestId={seek.id}
              onTimeUpdate={reportTime}
            />
          </div>
          {showChapterTimeline && (
            <>
              <div className="px-4 pt-3">
                <div
                  className="relative h-2 w-full rounded-full bg-neutral-700"
                  aria-label={t("helpdesk.timeline")}
                >
                  {tutorial.chapters.map((chapter) => (
                    <button
                      type="button"
                      key={chapter.id}
                      aria-label={`${formatHelpdeskTime(chapter.startMs / 1000)} ${chapter.title}`}
                      aria-current={activeChapter?.id === chapter.id || undefined}
                      onClick={() => seekChapter(chapter.startMs)}
                      title={chapter.title}
                      style={{
                        left: `${(chapter.startMs / tutorial.durationMs) * 100}%`,
                        width: `${((chapter.endMs - chapter.startMs) / tutorial.durationMs) * 100}%`,
                      }}
                      className={cn(
                        "absolute top-0 h-2 rounded-full border-r border-neutral-950 transition-colors focus-visible:outline focus-visible:outline-white",
                        activeChapter?.id === chapter.id
                          ? "bg-primary-400"
                          : "bg-neutral-500 hover:bg-neutral-400",
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-2 text-xs text-neutral-300">
                <span>{t("helpdesk.jumpHint")}</span>
                <span className="shrink-0 tabular-nums">
                  {formatHelpdeskTime(currentTimeMs / 1000)} /{" "}
                  {formatHelpdeskTime(tutorial.durationMs / 1000)}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="border-t border-neutral-100 bg-neutral-50 p-4 md:border-l md:border-t-0">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <ListVideo className="size-4" aria-hidden />
            {t("helpdesk.chapters")}
          </h3>
          <div className="space-y-1">
            {tutorial.chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => seekChapter(chapter.startMs)}
                aria-current={activeChapter?.id === chapter.id || undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start focus-visible:outline focus-visible:outline-primary-500",
                  activeChapter?.id === chapter.id
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-neutral-600 hover:bg-white",
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">
                  {activeChapter?.id === chapter.id ? (
                    <Play className="size-3" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block body-sm-md">{chapter.title}</span>
                  <span className="mt-1 block text-xs tabular-nums text-neutral-500">
                    {formatHelpdeskTime(chapter.startMs / 1000)}
                  </span>
                </span>
                {currentTimeMs >= chapter.endMs && (
                  <Check className="size-3 shrink-0" aria-hidden />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
