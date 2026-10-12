import { useTranslation } from "react-i18next";

import { IS_MONO_DESIGN } from "~/config/designVariant";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { MonoPagination } from "./mono/MonoPagination";
import { getPaginationRange, getPaginationState } from "./pagination.utils";
import { PaginationButton } from "./PaginationButton";

import type { PaginationProps } from "./pagination.types";

export { ITEMS_PER_PAGE_OPTIONS, NEWS_ITEMS_PER_PAGE_OPTIONS } from "./pagination.utils";
export type { ItemsPerPageOption } from "./pagination.types";

const DefaultPagination = ({
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

  const handleItemsPerPageChange = (newItemsPerPage: string) =>
    onItemsPerPageChange?.(newItemsPerPage);

  const renderPageButtons = () =>
    getPaginationRange(currentPage, totalPages).map(({ key, page, isEllipsis }) => (
      <PaginationButton
        key={key}
        page={page}
        currentPage={currentPage}
        onPageChange={onPageChange}
        text={isEllipsis ? "..." : undefined}
        testId={isEllipsis ? undefined : testIds?.page?.(page)}
      />
    ));

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
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage}
        >
          {t("pagination.previous")}
        </Button>
        {renderPageButtons()}
        <Button
          data-testid={testIds?.next}
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
        >
          {t("pagination.next")}
        </Button>
      </div>
    </div>
  );
};

// Design variant switch point: mono uses its own layout with the same props and test ids.
export const Pagination = IS_MONO_DESIGN ? MonoPagination : DefaultPagination;
