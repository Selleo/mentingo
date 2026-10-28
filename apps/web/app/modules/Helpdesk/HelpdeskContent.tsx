import { Link, useLocation } from "@remix-run/react";
import { GLOBAL_SEARCH_MODES } from "@repo/shared";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { HELPDESK_SEARCH_DEBOUNCE_MS } from "~/api/queries/helpdesk/helpdesk.keys";
import { useHelpdeskSearch } from "~/api/queries/helpdesk/useHelpdeskSearch";
import { GlobalSearchAskAiRow } from "~/components/Navigation/GlobalSearch/GlobalSearchAskAiRow";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import { useDebounce } from "~/hooks/useDebounce";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { getHelpdeskPageKey, groupHelpdeskResults } from "./helpdesk.helpers";
import { HelpdeskLoading, HelpdeskRequestError } from "./HelpdeskRequestState";
import { HelpdeskSearchResult } from "./HelpdeskSearchResult";

import type { HelpdeskSelection } from "./helpdesk.types";

export default function HelpdeskContent({
  onSelect,
  onAskAssistant,
}: {
  onSelect: (selection: HelpdeskSelection) => void;
  onAskAssistant: () => void;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const language = useLanguageStore((state) => state.language);
  const [query, setQuery] = useState("");
  const [aiQuery, setAiQuery] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query.trim(), HELPDESK_SEARCH_DEBOUNCE_MS);
  const isAiSearch = aiQuery !== null;
  const searchQuery = aiQuery ?? debouncedQuery;
  const mode = isAiSearch ? GLOBAL_SEARCH_MODES.HYBRID : GLOBAL_SEARCH_MODES.KEYWORD;
  const { data, isPending, isError, error, refetch } = useHelpdeskSearch({
    query: searchQuery,
    mode,
    language,
    pageKey: getHelpdeskPageKey(pathname),
    limit: 8,
  });
  const waiting = isPending || (!isAiSearch && query.trim() !== debouncedQuery);

  return (
    <div className="flex max-h-[85dvh] flex-col">
      <div className="shrink-0 border-b border-neutral-100 px-5 pb-4 pt-5">
        <h2 className="mb-1 pr-7 text-lg font-semibold text-neutral-950">
          {t("helpdesk.heading")}
        </h2>
        <p className="body-sm text-neutral-600">{t("helpdesk.subtitle")}</p>
        <Link
          to="/assistant"
          onClick={onAskAssistant}
          className="mt-4 flex w-full items-center gap-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-3 text-start transition-colors hover:border-primary-300 focus-visible:outline focus-visible:outline-primary-500"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block body-sm-md text-neutral-950">{t("helpdesk.askAssistant")}</span>
            <span className="block details text-neutral-600">{t("helpdesk.assistantHint")}</span>
          </span>
          <ArrowRight className="size-4 text-primary-600" aria-hidden />
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pt-4">
          <SearchInput
            value={query}
            maxLength={500}
            aria-label={t("helpdesk.search")}
            placeholder={t("helpdesk.search")}
            wrapperClassName="w-full max-w-none"
            className="!max-w-none pr-10"
            onChange={(event) => {
              setQuery(event.target.value);
              setAiQuery(null);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && query.trim()) {
                event.preventDefault();
                setAiQuery(query.trim());
              }
            }}
            rightAdornment={
              query && (
                <button
                  type="button"
                  aria-label={t("helpdesk.clear")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 hover:text-neutral-950"
                  onClick={() => {
                    setQuery("");
                    setAiQuery(null);
                  }}
                >
                  <X className="size-4" aria-hidden />
                </button>
              )
            }
          />
          {query.trim() && !isAiSearch && (
            <GlobalSearchAskAiRow
              title={t("globalSearch.aiSearch")}
              query={query.trim()}
              isActive={false}
              onClick={() => setAiQuery(query.trim())}
            />
          )}
          {isAiSearch && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 details text-primary-700">
                <Sparkles className="size-3.5" aria-hidden />
                {t("globalSearch.hybridSearch")}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setAiQuery(null)}>
                {t("globalSearch.backToKeywords")}
              </Button>
            </div>
          )}
          {!waiting && isAiSearch && data?.mode === "keyword_fallback" && (
            <p role="status" className="mt-2 details text-neutral-500">
              {t("helpdesk.keywordFallback")}
            </p>
          )}
        </div>
        {waiting && <HelpdeskLoading />}
        {!waiting && isError && (
          <HelpdeskRequestError
            error={error}
            onRetry={() => {
              void refetch();
            }}
          />
        )}
        {!waiting && !isError && data && (
          <div className="px-3 pb-3 pt-4">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {searchQuery ? t("helpdesk.results") : t("helpdesk.suggested")}
            </h3>
            {data.results.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="body-sm-md text-neutral-800">{t("helpdesk.empty")}</p>
                <p className="mt-1 body-sm text-neutral-500">{t("helpdesk.emptyHint")}</p>
              </div>
            )}
            <ul className="space-y-1">
              {groupHelpdeskResults(data.results).map((group) => (
                <HelpdeskSearchResult
                  key={group.tutorial.revisionId}
                  group={group}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
