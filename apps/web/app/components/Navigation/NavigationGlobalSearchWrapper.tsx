import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAIConfigured } from "~/api/queries/useAIConfigured";
import { useHandleKeyboardShortcut } from "~/hooks/useHandleKeyboardShortcut";

import { useGlobalSettings } from "../../api/queries/useGlobalSettings";
import {
  GlobalSearchMac,
  GlobalSearchWin,
  KeyboardArrows,
  KeyboardEnter,
  KeyboardX,
  Search,
} from "../../assets/svgs";
import { useDebounce } from "../../hooks/useDebounce";
import { cn } from "../../lib/utils";
import { SearchInput } from "../SearchInput/SearchInput";
import { Dialog, DialogContent } from "../ui/dialog";
import { Separator } from "../ui/separator";

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
  const mode = activeHybridSearch === null ? "keyword" : "hybrid";
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

  useEffect(() => {
    setActiveIndex(0);
  }, [effectiveSearch, mode]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("button, a, [role=button]")) return;
    if (isDebouncing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(1, totalItemsRef.current));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + totalItemsRef.current) % Math.max(1, totalItemsRef.current),
      );
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
          style={{ padding: 0, overflow: "hidden" }}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col gap-1 p-3">
            <SearchInput
              value={searchParams}
              maxLength={500}
              onChange={(e) => {
                setSearchParams(e.target.value.slice(0, 500));
                setHybridSearch(null);
                setActiveIndex(0);
                totalItemsRef.current = 0;
              }}
              aria-label={t("globalSearch.search")}
              rightAdornment={
                <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  {searchParams.length > 0 && (
                    <button
                      type="button"
                      aria-label={t("globalSearch.clear")}
                      onClick={() => {
                        setSearchParams("");
                        setHybridSearch(null);
                        totalItemsRef.current = 0;
                      }}
                      className="rounded p-1 text-neutral-600 focus-visible:outline focus-visible:outline-primary-500"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                  {isSemanticConfigured && (
                    <button
                      type="button"
                      aria-label={t("globalSearch.searchByMeaning")}
                      title={t("globalSearch.searchByMeaning")}
                      disabled={searchParams.trim().length < 3}
                      aria-pressed={mode === "hybrid"}
                      onClick={() => {
                        setHybridSearch(searchParams.trim());
                        setActiveIndex(0);
                        totalItemsRef.current = 0;
                      }}
                      className={cn(
                        "rounded p-1.5 text-primary-600 hover:bg-primary-50 focus-visible:outline focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-40",
                        mode === "hybrid" && "bg-primary-100",
                      )}
                    >
                      <Sparkles className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              }
              wrapperClassName="w-full max-w-none"
              className={cn("!max-w-none", {
                "pr-20": isSemanticConfigured,
                "pr-10": !isSemanticConfigured,
              })}
            />
            {mode === "hybrid" && (
              <div className="flex items-center justify-between gap-2 px-2 text-xs text-neutral-600">
                <span>{t("globalSearch.hybridSearch")}</span>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-primary-600 focus-visible:outline focus-visible:outline-primary-500"
                  onClick={() => setHybridSearch(null)}
                >
                  {t("globalSearch.backToKeywords")}
                </button>
              </div>
            )}
            <Separator className="my-2" />
            {searchParams.trim().length < 3 && (
              <div className="flex flex-col px-6 pt-4">
                <span className="text-sm-md text-center ">
                  {companyName
                    ? t("globalSearch.searchIn", { companyName })
                    : t("common.other.search")}
                </span>
                <span className="mt-2 details text-center text-neutral-800">
                  {t("globalSearch.searchInDescription")}
                </span>
              </div>
            )}
            {searchParams.trim().length >= 3 && (
              <GlobalSearchResults
                debouncedSearch={effectiveSearch}
                mode={mode}
                isDebouncing={isDebouncing}
                onSelect={handleSelect}
                activeIndex={activeIndex}
                setTotalItems={(count) => {
                  totalItemsRef.current = count;
                }}
              />
            )}
          </div>
          <div className="flex items-center justify-end gap-[12px] border-t border-[#F1F5F9] bg-neutral-50 px-4 py-2">
            <div className="text-md flex h-5 items-center gap-[6px]">
              <KeyboardArrows />
              <span className="details text-neutral-800">{t("globalSearch.navigate")}</span>
            </div>
            <div className="flex h-5 items-center gap-[6px]">
              <KeyboardEnter />
              <span className="details text-neutral-800">{t("globalSearch.goTo")}</span>
            </div>
            <div className="flex h-5 items-center gap-1.5 details text-neutral-800">
              <div className="flex items-center gap-px">
                <KeyboardX />
                <span className="font-normal text-neutral-700">/</span>
                {isMac ? (
                  <GlobalSearchMac height={20} fill="#FCFCFC" />
                ) : (
                  <GlobalSearchWin height={20} fill="#FCFCFC" />
                )}
              </div>
              <span>{t("globalSearch.close")}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

NavigationGlobalSearchWrapper.displayName = "NavigationGlobalSearch";
