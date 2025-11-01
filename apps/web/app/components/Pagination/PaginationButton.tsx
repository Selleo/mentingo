import { cn } from "~/lib/utils";

import { Button } from "../ui/button";

interface PaginationButtonProps {
  page: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  text?: string | number;
}

export const PaginationButton = ({
  page,
  currentPage,
  onPageChange,
  text,
}: PaginationButtonProps) => {
  return (
    <Button
      key={page}
      variant="ghost"
      size="sm"
      className={cn("text-neutral-800 aspect-square hover:text-primary-700 hover:bg-primary-200", {
        "bg-primary-700 text-white": currentPage === page,
      })}
      onClick={() => onPageChange(page)}
    >
      {text ?? page}
    </Button>
  );
};
