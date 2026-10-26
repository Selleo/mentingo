import { GLOBAL_SEARCH_MODES } from "@repo/shared";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAIConfigured } from "~/api/queries/useAIConfigured";
import { useHandleKeyboardShortcut } from "~/hooks/useHandleKeyboardShortcut";

import { useGlobalSettings } from "../../api/queries/useGlobalSettings";
import { GlobalSearchMac, GlobalSearchWin, Search } from "../../assets/svgs";
import { useDebounce } from "../../hooks/useDebounce";
import { cn } from "../../lib/utils";
import { SearchInput } from "../SearchInput/SearchInput";
import { Dialog, DialogContent } from "../ui/dialog";

import { GlobalSearchAskAiRow } from "./GlobalSearch/GlobalSearchAskAiRow";
import {
  ASK_AI_INDEX,
  GLOBAL_SEARCH_QUERY,
  isNaturalLanguageQuery,
  isSearchableQuery,
} from "./GlobalSearch/globalSearchQuery";
import { GlobalSearchResults } from "./GlobalSearch/GlobalSearchResults";
import { NavigationMenuButton } from "./NavigationMenuButton";

export type NavigationGlobalSearchWrapperProps = {
  containerClassName?: string;
  autoFocusOnMount?: boolean;
  useCompactVariant?: boolean;
};

export const NavigationGlobalSearchWrapper = ({
  containerClassName,
  useCompactVariant = false,
}: NavigationGlobalSearchWrapperProps) => {
  const [searchParams, setSearchParams] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [hybridSearch, setHybridSearch] = useState<string | null>(null);
  const { data: aiConfigured } = useAIConfigured();
  const isSemanticConfigured = aiConfigured?.enabled === true;
  const debouncedSearch = useDebounce(searchParams, 300);
  const activeHybridSearch = isSemanticConfigured ? hybridSearch : null;
  const effectiveSearch = activeHybridSearch ?? debouncedSearch.trim();
  const mode =
    activeHybridSearch === null ? GLOBAL_SEARCH_MODES.KEYWORD : GLOBAL_SEARCH_MODES.HYBRID;
  const isDebouncing =
    activeHybridSearch === null && debouncedSearch.trim() !== searchParams.trim();
  const totalItemsRef = useRef(0);
  const { t } = useTranslation();
  const { data: globalSettings } = useGlobalSettings();
  const [isGlobalSearchDialogOpen, setIsGlobalSearchDialogOpen] = useState(false);

  useHandleKeyboardShortcut({
    shortcuts: [
      { key: "k", metaKey: true },
      { key: "k", ctrlKey: true },
    ],
    onShortcut: () => {
      setIsGlobalSearchDialogOpen((prev) => !prev);
    },
  });

  const companyName =
    globalSettings?.companyInformation?.companyShortName &&
    globalSettings?.companyInformation?.companyShortName.length > 0
      ? globalSettings?.companyInformation?.companyShortName
      : null;

  const isMac =
    typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("mac");
  const hasSearchableQuery = isSearchableQuery(searchParams);
  const isAiMode = mode === GLOBAL_SEARCH_MODES.HYBRID;
  const showAskAi = isSemanticConfigured && !isAiMode && hasSearchableQuery;
  // Questions and sentences start on the AI row; title-like lookups start on the top match.
  const isAskAiDefault = showAskAi && isNaturalLanguageQuery(searchParams);
  const firstIndex = showAskAi ? ASK_AI_INDEX : 0;
  const initialActiveIndex = (query: string) =>
    isSemanticConfigured && isNaturalLanguageQuery(query) ? ASK_AI_INDEX : 0;

  useEffect(() => {
    setActiveIndex(isAskAiDefault ? ASK_AI_INDEX : 0);
  }, [effectiveSearch, mode, isAskAiDefault]);

  useEffect(() => {
    if (!isSemanticConfigured) {
      setHybridSearch(null);
      totalItemsRef.current = 0;
    }
  }, [isSemanticConfigured]);

  useEffect(() => {
    setSearchParams("");
    setHybridSearch(null);
    totalItemsRef.current = 0;
    if (isGlobalSearchDialogOpen) {
      setActiveIndex(0);
    }
  }, [isGlobalSearchDialogOpen]);

  const handleSelect = () => {
    setSearchParams("");
    setIsGlobalSearchDialogOpen(false);
  };

  /** Explicit AI opt-in: submits the current text once; editing the query returns to keywords. */
  const startAiSearch = () => {
    if (!isSemanticConfigured || !hasSearchableQuery) return;
    setHybridSearch(searchParams.trim());
    setActiveIndex(0);
    totalItemsRef.current = 0;
  };

  const backToKeywords = () => {
    setHybridSearch(null);
    setActiveIndex(0);
    totalItemsRef.current = 0;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.target instanceof HTMLElement && e.target.closest("button, a, [role=button]")) return;
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!e.repeat) startAiSearch();
      return;
    }
    if (e.key === "Enter" && showAskAi && activeIndex === ASK_AI_INDEX) {
      e.preventDefault();
      if (!e.repeat) startAiSearch();
      return;
    }
    if (isDebouncing) return;
    const lastIndex = totalItemsRef.current - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev >= lastIndex ? firstIndex : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= firstIndex ? Math.max(lastIndex, firstIndex) : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const activeListItem = document.querySelector(`[data-search-index="${activeIndex}"]`);
      if (activeListItem) {
        const clickableElement = activeListItem.querySelector("a, button");

        if (clickableElement instanceof HTMLElement) {
          clickableElement.click();
          setIsGlobalSearchDialogOpen(false);
          setSearchParams("");
        }
      }
    }
  };

  return (
    <div className={cn("relative", containerClassName)}>
      {useCompactVariant ? (
        <NavigationMenuButton
          item={{ iconName: "Search", label: t("navigationSideBar.findInApplication") }}
          onClick={() => setIsGlobalSearchDialogOpen(true)}
          wrapperClassName="list-none hidden 2xl:block"
          className="justify-center bg-neutral-50 p-2 2xl:h-[42px] 2xl:w-[42px] 2xl:bg-white"
          labelClassName="sr-only"
          hideLabel
          showTooltip
        />
      ) : (
        <button
          aria-label={t("navigationSideBar.findInApplication")}
          onClick={() => setIsGlobalSearchDialogOpen(true)}
          className={cn(
            "flex size-10 items-center justify-center rounded-lg bg-neutral-50 p-2 text-neutral-800 transition-colors hover:text-primary-500",
            "2xl:h-[42px] 2xl:w-full 2xl:justify-start 2xl:border 2xl:border-neutral-300 2xl:bg-white 2xl:py-2 2xl:pl-8 2xl:pr-8 2xl:hover:border-primary-500",
          )}
        >
          <Search className="size-6 transition-colors 2xl:absolute 2xl:left-2 2xl:top-1/2 2xl:size-5 2xl:-translate-y-1/2 2xl:transform" />
          <span className="body-base hidden w-full text-start text-current transition-colors 2xl:inline-block">
            {t("globalSearch.search")}
          </span>
          {isMac ? (
            <GlobalSearchMac className="absolute right-2 top-1/2 hidden -translate-y-1/2 transform 2xl:block" />
          ) : (
            <GlobalSearchWin className="absolute right-2 top-1/2 hidden -translate-y-1/2 transform 2xl:block" />
          )}
        </button>
      )}

      <Dialog open={isGlobalSearchDialogOpen} onOpenChange={setIsGlobalSearchDialogOpen}>
        <DialogContent
          noCloseButton
          // One column clamped to the dialog width, so long result text truncates instead of
          // stretching the grid track past the dialog edge.
          className="grid-cols-[minmax(0,1fr)]"
          style={{ padding: 0, overflow: "hidden" }}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col gap-1 border-b border-neutral-100 p-3 pb-2">
            <SearchInput
              value={searchParams}
              maxLength={GLOBAL_SEARCH_QUERY.MAX_LENGTH}
              onChange={(e) => {
                const nextQuery = e.target.value.slice(0, GLOBAL_SEARCH_QUERY.MAX_LENGTH);
                setSearchParams(nextQuery);
                setHybridSearch(null);
                setActiveIndex(initialActiveIndex(nextQuery));
                totalItemsRef.current = 0;
              }}
              aria-label={t("globalSearch.search")}
              placeholder={t("globalSearch.search")}
              leadingIcon={
                isAiMode ? (
                  <Sparkles
                    className="absolute left-2 top-1/2 size-5 -translate-y-1/2 text-primary-600"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                ) : undefined
              }
              rightAdornment={
                searchParams.length > 0 && (
                  <button
                    type="button"
                    aria-label={t("globalSearch.clear")}
                    onClick={() => {
                      setSearchParams("");
                      setHybridSearch(null);
                      totalItemsRef.current = 0;
                    }}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-600 focus-visible:outline focus-visible:outline-primary-500"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )
              }
              wrapperClassName="w-full max-w-none"
              className={cn(
                "!max-w-none pr-10",
                isAiMode && "border-primary-200 focus:border-primary-500",
              )}
            />
            {showAskAi && (
              <GlobalSearchAskAiRow
                title={t("globalSearch.aiSearch")}
                query={searchParams.trim()}
                isActive={activeIndex === ASK_AI_INDEX}
                onClick={startAiSearch}
              />
            )}
          </div>
          <div className="px-1.5 pb-2 pt-2">
            {!hasSearchableQuery && (
              <div className="flex flex-col px-6 py-6 text-center">
                <span className="text-sm-md">
                  {companyName
                    ? t("globalSearch.searchIn", { companyName })
                    : t("common.other.search")}
                </span>
                <span className="mt-2 details text-neutral-600">
                  {isSemanticConfigured
                    ? t("globalSearch.searchInDescriptionWithAi")
                    : t("globalSearch.searchInDescription")}
                </span>
              </div>
            )}
            {hasSearchableQuery && (
              <GlobalSearchResults
                debouncedSearch={effectiveSearch}
                mode={mode}
                isDebouncing={isDebouncing}
                onSelect={handleSelect}
                activeIndex={activeIndex}
                setTotalItems={(count) => {
                  totalItemsRef.current = count;
                }}
                onBackToKeywords={backToKeywords}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-neutral-100 bg-neutral-50 px-4 py-2.5">
            <KeyHint keys="↑↓" label={t("globalSearch.navigate")} />
            <KeyHint keys="↵" label={t("globalSearch.goTo")} />
            <KeyHint keys="esc" label={t("globalSearch.close")} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

NavigationGlobalSearchWrapper.displayName = "NavigationGlobalSearch";

const KeyHint = ({ keys, label }: { keys: string; label: string }) => (
  <span className="flex h-5 items-center gap-1.5 whitespace-nowrap details text-neutral-600">
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-neutral-200 bg-white px-1 font-sans text-xs text-neutral-700">
      {keys}
    </kbd>
    {label}
  </span>
);
