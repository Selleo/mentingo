import { ArrowUpRight, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useHelpdeskSearch } from "~/api/queries/helpdesk/useHelpdeskSearch";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { HELPDESK_DOMAIN_LABELS } from "./helpdesk.helpers";

import type { HelpdeskSelection } from "./helpdesk.types";

export function HelpdeskRelatedTutorials({
  currentKey,
  onSelect,
}: {
  currentKey: string;
  onSelect: (selection: HelpdeskSelection) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data } = useHelpdeskSearch({ query: "", language, limit: 10 });
  const tutorials = data?.results.filter((hit) => hit.tutorial.key !== currentKey) ?? [];
  if (!tutorials.length) return null;
  return (
    <div className="px-6 py-5">
      <h3 className="mb-3 body-sm-md text-neutral-900">{t("helpdesk.related")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {tutorials.map(({ tutorial }) => (
          <button
            key={tutorial.revisionId}
            type="button"
            onClick={() => onSelect({ tutorial, startMs: 0 })}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 text-start transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline focus-visible:outline-primary-500"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <Play className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block body-sm-md text-neutral-900">{tutorial.title}</span>
              <span className="mt-1 block text-xs text-neutral-500">
                {t(HELPDESK_DOMAIN_LABELS[tutorial.domain])}
              </span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
