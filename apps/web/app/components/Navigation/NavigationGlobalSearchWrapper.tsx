import { useEffect, useRef, useState } from "react";

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

export type NavigationGlobalSearchWrapperProps = {
  containerClassName?: string;
  autoFocusOnMount?: boolean;
  isDialogOpen: boolean;
  setIsDialogOpen: (isDialogOpen: boolean) => void;
};

export const NavigationGlobalSearchWrapper = ({
  containerClassName,
  isDialogOpen,
  setIsDialogOpen,
}: NavigationGlobalSearchWrapperProps) => {
  const [searchParams, setSearchParams] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedSearch = useDebounce(searchParams, 300);
  const { isAdmin, isContentCreator } = useUserRole();
  const totalItemsRef = useRef(0);
  const { data: globalSettings } = useGlobalSettings();

  const companyName =
    globalSettings?.companyInformation?.companyName &&
    globalSettings.companyInformation.companyName.length > 0
      ? globalSettings?.companyInformation?.companyName
      : "Your Company";

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
    if (isDialogOpen) {
      setActiveIndex(0);
    }
  }, [isDialogOpen]);

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
          setIsDialogOpen(false);
          setSearchParams("");
        }
      }
    }
  };

  return (
    <div className={cn("relative", containerClassName)}>
      <button
        onClick={() => setIsDialogOpen(true)}
        className="h-[42px] w-full max-w-[320px] rounded-lg border border-neutral-300 py-2 pl-8 pr-8 text-neutral-800 transition-colors hover:border-primary-500 hover:text-primary-500 md:max-w-none"
      >
        <Search className="absolute left-2 top-1/2 size-5 -translate-y-1/2 transform transition-colors" />
        <span className="body-base inline-block w-full text-start text-current transition-colors">
          Search...
        </span>
        {isMac ? (
          <GlobalSearchMac className="absolute right-2 top-1/2 -translate-y-1/2 transform" />
        ) : (
          <GlobalSearchWin className="absolute right-2 top-1/2 -translate-y-1/2 transform" />
        )}
      </button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                <span className="text-center text-sm font-semibold text-neutral-950">
                  Search in {companyName}
                </span>
                <span className="text-normal-800 text-center text-[12px] font-normal leading-[160%]">
                  Start typing to search through courses, announcements and more.
                </span>
              </div>
            )}
            {debouncedSearch.length >= 3 && (
              <ResultsComponent
                debouncedSearch={debouncedSearch}
                onSelect={() => setSearchParams("")}
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
              <span className="text-md text-[12px] font-semibold leading-[160%] text-neutral-800">
                Navigate
              </span>
            </div>
            <div className="flex h-5 items-center gap-[6px]">
              <KeyboardEnter />
              <span className="text-md text-[12px] font-semibold leading-[160%] text-neutral-800">
                Go to
              </span>
            </div>
            <div className="flex h-5 items-center gap-[6px] text-[12px] font-semibold leading-[160%] text-neutral-800">
              <div className="flex items-center gap-[1px]">
                <KeyboardX />
                <span className="font-normal text-neutral-700">/</span>
                {isMac ? (
                  <GlobalSearchMac height={20} fill="#FCFCFC" />
                ) : (
                  <GlobalSearchWin height={20} fill="#FCFCFC" />
                )}
              </div>
              <span>Close</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

NavigationGlobalSearchWrapper.displayName = "NavigationGlobalSearch";
