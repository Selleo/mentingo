import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { PaginationButton } from "./PaginationButton";

interface PaginationProps {
  className?: string;
  totalItems?: number;
  itemsPerPage?: number;
  currentPage?: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({
  className,
  totalItems = 0,
  itemsPerPage = 10,
  currentPage = 1,
  onPageChange,
}: PaginationProps) => {
  const { t } = useTranslation();

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const renderPageButtons = () => {
    const buttons: JSX.Element[] = [];

    if (currentPage > 2) {
      buttons.push(
        <PaginationButton key={1} page={1} currentPage={currentPage} onPageChange={onPageChange} />,
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
        />,
      );
    }

    return buttons;
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={cn("px-4 py-2.5 flex items-center justify-between", className)}>
      <div className="body-sm text-neutral-800">
        {t("pagination.showing", { startItem, endItem, totalItems })}
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={currentPage <= 1}>
          {t("pagination.previous")}
        </Button>
        {renderPageButtons()}
        <Button variant="ghost" size="sm" onClick={handleNext} disabled={currentPage >= totalPages}>
          {t("pagination.next")}
        </Button>
      </div>
    </div>
  );
};
