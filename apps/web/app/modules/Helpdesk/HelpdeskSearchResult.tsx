import { ChevronRight, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  formatHelpdeskTime,
  HELPDESK_DOMAIN_LABELS,
  helpdeskTutorialLabel,
} from "./helpdesk.helpers";

import type { HelpdeskResultGroup } from "./helpdesk.helpers";
import type { HelpdeskSelection } from "./helpdesk.types";

type Props = {
  group: HelpdeskResultGroup;
  onSelect: (selection: HelpdeskSelection) => void;
};

export function HelpdeskSearchResult({ group, onSelect }: Props) {
  const { t } = useTranslation();
  const { tutorial, chapters } = group;
  const { title, isDemo } = helpdeskTutorialLabel(tutorial);

  return (
    <li className="rounded-lg">
      <button
        type="button"
        onClick={() => onSelect({ tutorial, startMs: group.startMs })}
        className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-start transition-colors hover:bg-neutral-50 focus-visible:bg-primary-50 focus-visible:outline focus-visible:outline-primary-400"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Play className="size-4" strokeWidth={1.6} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 body-sm-md text-neutral-950">{title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-neutral-500">
            <span>{t(HELPDESK_DOMAIN_LABELS[tutorial.domain])}</span>
            <span aria-hidden>·</span>
            <span>{formatHelpdeskTime(tutorial.durationMs / 1000)}</span>
            {isDemo && (
              <span className="rounded border border-neutral-200 px-1 py-px text-[10px] leading-3">
                {t("helpdesk.demo")}
              </span>
            )}
            {tutorial.languageFallback && (
              <span>{t("helpdesk.languageFallback", { language: tutorial.language })}</span>
            )}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
      </button>
      {chapters.length > 0 && (
        <ul className="mb-2 ml-[26px] border-l border-neutral-200 pl-5">
          {chapters.map(({ chapter, startMs }) => (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => onSelect({ tutorial, startMs })}
                className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-start text-xs transition-colors hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline focus-visible:outline-primary-400"
              >
                <span className="shrink-0 tabular-nums text-primary-700">
                  {formatHelpdeskTime(startMs / 1000)}
                </span>
                <span className="truncate text-neutral-700">{chapter.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
