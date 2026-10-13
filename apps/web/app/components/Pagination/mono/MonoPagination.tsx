import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { getFixedLengthPaginationRange, getPaginationState } from "../pagination.utils";
import { PaginationButton } from "../PaginationButton";

import type { PaginationProps } from "../pagination.types";

export const MonoPagination = ({
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

  const { totalPages, startItem, endItem, itemsPerPageOptions, hasPreviousPage, hasNextPage } =
    getPaginationState({
      totalItems,
      itemsPerPage,
      currentPage,
      overrideTotalPages,
      startItemOverride,
      endItemOverride,
    });

  if (totalItems === 0) {
    return (
      <div className={cn("w-full py-8 text-center text-base text-neutral-700", emptyDataClassName)}>
        {t("pagination.noData")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid items-center gap-x-6 gap-y-2 px-4 py-2.5 text-sm text-neutral-800 sm:grid-cols-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-end">
        {canChangeItemsPerPage && (
          <div className="flex items-center gap-2">
            <span>{t("pagination.rowsPerPage")}</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => onItemsPerPageChange?.(value)}
            >
              <SelectTrigger
                data-testid={testIds?.itemsPerPage}
                className="h-8 w-fit gap-2 border-0 bg-transparent px-1 mono:text-neutral-800"
              >
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
          </div>
        )}
        <span>{t("pagination.itemsRange", { startItem, endItem, count: totalItems })}</span>
      </div>
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <Button
          data-testid={testIds?.previous}
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t("pagination.previous")}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        {getFixedLengthPaginationRange(currentPage, totalPages).map(({ key, page, isEllipsis }) => (
          <PaginationButton
            key={key}
            page={page}
            currentPage={currentPage}
            text={isEllipsis ? "..." : undefined}
            testId={isEllipsis ? undefined : testIds?.page?.(page)}
            onPageChange={onPageChange}
          />
        ))}
        <Button
          data-testid={testIds?.next}
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t("pagination.next")}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};
