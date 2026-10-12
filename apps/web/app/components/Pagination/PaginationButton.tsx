import { cn } from "~/lib/utils";

import { Button } from "../ui/button";

interface PaginationButtonProps {
  page: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  text?: string | number;
  testId?: string;
}

export const PaginationButton = ({
  page,
  currentPage,
  onPageChange,
  text,
  testId,
}: PaginationButtonProps) => {
  const isCurrent = currentPage === page;

  return (
    <Button
      key={page}
      data-testid={testId}
      variant="ghost"
      size="sm"
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "text-neutral-800 aspect-square hover:text-primary-700 hover:bg-primary-200",
        "mono:size-8 mono:rounded-md mono:p-0 mono:font-[inherit] mono:text-base mono:font-normal mono:tracking-normal mono:text-neutral-700 mono:hover:bg-neutral-100 mono:hover:text-neutral-950",
        isCurrent && [
          "bg-primary-700 text-white",
          "mono:bg-primary-700 mono:text-white mono:hover:bg-primary-800 mono:hover:text-white mono:focus-visible:bg-primary-800 mono:active:bg-primary-900",
        ],
      )}
      onClick={() => onPageChange(page)}
    >
      {text ?? page}
    </Button>
  );
};
