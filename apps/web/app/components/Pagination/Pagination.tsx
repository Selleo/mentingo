import { useTranslation } from "react-i18next";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { PaginationButton } from "./PaginationButton";

interface PaginationProps {
  className?: string;
  emptyDataClassName?: string;
  totalItems?: number;
  itemsPerPage?: ItemsPerPageOption;
  currentPage?: number;
  canChangeItemsPerPage?: boolean;
  overrideTotalPages?: number;
  startItemOverride?: number;
  endItemOverride?: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: string) => void;
  testIds?: {
    previous?: string;
    next?: string;
    page?: (page: number) => string;
    itemsPerPage?: string;
    itemsPerPageOption?: (itemsPerPage: number) => string;
  };
}

export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
export const NEWS_ITEMS_PER_PAGE_OPTIONS = [7, 9] as const;

export type ItemsPerPageOption =
  | (typeof ITEMS_PER_PAGE_OPTIONS)[number]
  | (typeof NEWS_ITEMS_PER_PAGE_OPTIONS)[number];

export const Pagination = ({
  className,
  emptyDataClassName,
  totalItems = 0,
  itemsPerPage = 10,
  currentPage = 1,
  canChangeItemsPerPage = true,
  overrideTotalPages,
  startItemOverride,
  endItemOverride,
  onPageChange,
  onItemsPerPageChange,
  testIds,
}: PaginationProps) => {
  const { t } = useTranslation();

  const totalPages = overrideTotalPages ?? Math.ceil(totalItems / itemsPerPage);
  const startItem = startItemOverride ?? (currentPage - 1) * itemsPerPage + 1;
  const endItem = endItemOverride ?? Math.min(currentPage * itemsPerPage, totalItems);
  const itemsPerPageOptions = NEWS_ITEMS_PER_PAGE_OPTIONS.includes(
    itemsPerPage as (typeof NEWS_ITEMS_PER_PAGE_OPTIONS)[number],
  )
    ? NEWS_ITEMS_PER_PAGE_OPTIONS
    : ITEMS_PER_PAGE_OPTIONS;

  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const handleItemsPerPageChange = (newItemsPerPage: string) =>
    onItemsPerPageChange?.(newItemsPerPage);

  const renderPageButtons = () => {
    const buttons: JSX.Element[] = [];

    if (currentPage > 2) {
      buttons.push(
        <PaginationButton
          key={1}
          page={1}
          currentPage={currentPage}
          onPageChange={onPageChange}
          testId={testIds?.page?.(1)}
        />,
      );
    }

    if (currentPage > 3) {
      buttons.push(
        <PaginationButton
          key="start-ellipsis"
          page={currentPage - 2}
          currentPage={currentPage}
          onPageChange={onPageChange}
          text="..."
        />,
      );
    }

    for (
      let page = Math.max(1, currentPage - 1);
      page <= Math.min(totalPages, currentPage + 1);
      page++
    ) {
      buttons.push(
        <PaginationButton
          key={page}
          page={page}
          currentPage={currentPage}
          onPageChange={onPageChange}
          testId={testIds?.page?.(page)}
        />,
      );
    }

    if (currentPage < totalPages - 2) {
      buttons.push(
        <PaginationButton
          key="end-ellipsis"
          page={currentPage + 2}
          currentPage={currentPage}
          onPageChange={onPageChange}
          text="..."
        />,
      );
    }

    if (currentPage < totalPages - 1) {
      buttons.push(
        <PaginationButton
          key={totalPages}
          page={totalPages}
          currentPage={currentPage}
          onPageChange={onPageChange}
          testId={testIds?.page?.(totalPages)}
        />,
      );
    }

    return buttons;
  };

  if (totalItems === 0) {
    return (
      <div className={cn("w-full text-center py-8 body-base-md", emptyDataClassName)}>
        {t("pagination.noData")}
      </div>
    );
  }

  return (
    <div className={cn("px-4 py-2.5 flex items-center justify-between", className)}>
      <div className="flex items-center gap-2">
        <div className="body-sm text-neutral-800">
          {t("pagination.showing", { startItem, endItem, totalItems })}
        </div>
        {canChangeItemsPerPage && (
          <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger data-testid={testIds?.itemsPerPage} className="w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itemsPerPageOptions.map((option) => (
                <SelectItem
                  key={option}
                  value={String(option)}
                  data-testid={testIds?.itemsPerPageOption?.(option)}
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          data-testid={testIds?.previous}
          variant="ghost"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage <= 1}
        >
          {t("pagination.previous")}
        </Button>
        {renderPageButtons()}
        <Button
          data-testid={testIds?.next}
          variant="ghost"
          size="sm"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
        >
          {t("pagination.next")}
        </Button>
      </div>
    </div>
  );
};
