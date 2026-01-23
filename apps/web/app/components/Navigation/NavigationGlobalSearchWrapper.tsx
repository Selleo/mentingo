import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { useUserRole } from "../../hooks/useUserRole";
import { cn } from "../../lib/utils";
import { SearchInput } from "../SearchInput/SearchInput";
import { Dialog, DialogContent } from "../ui/dialog";
import { Separator } from "../ui/separator";

import { GlobalSearchAdminResults } from "./GlobalSearch/GlobalSearchAdminResults";
import { GlobalSearchContentCreatorResults } from "./GlobalSearch/GlobalSearchContentCreatorResults";
import { GlobalSearchStudentResults } from "./GlobalSearch/GlobalSearchStudentResults";
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
  const debouncedSearch = useDebounce(searchParams, 300);
  const { isAdmin, isContentCreator } = useUserRole();
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

  const ResultsComponent = isAdmin
    ? GlobalSearchAdminResults
    : isContentCreator
      ? GlobalSearchContentCreatorResults
      : GlobalSearchStudentResults;

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchParams("");
    if (isGlobalSearchDialogOpen) {
      setActiveIndex(0);
    }
  }, [isGlobalSearchDialogOpen]);

  const handleSelect = () => {
    setSearchParams("");
    setIsGlobalSearchDialogOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
          onClick={() => setIsGlobalSearchDialogOpen(true)}
          className={cn(
            "hidden h-[42px] w-full items-center justify-start rounded-lg border border-neutral-300 bg-white py-2 px-0 pl-8 pr-8 text-neutral-800 transition-colors hover:border-primary-500 hover:text-primary-500",
            "2xl:flex",
          )}
        >
          <Search className="absolute left-2 top-1/2 size-5 -translate-y-1/2 transform transition-colors" />
          <span className="body-base inline-block w-full text-start text-current transition-colors">
            {t("globalSearch.search")}
          </span>
          {isMac ? (
            <GlobalSearchMac className="absolute right-2 top-1/2 -translate-y-1/2 transform" />
          ) : (
            <GlobalSearchWin className="absolute right-2 top-1/2 -translate-y-1/2 transform" />
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
              onChange={(e) => setSearchParams(e.target.value)}
              clearable
            />
            <Separator className="my-2" />
            {debouncedSearch.length < 3 && (
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
            {debouncedSearch.length >= 3 && (
              <ResultsComponent
                debouncedSearch={debouncedSearch}
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
