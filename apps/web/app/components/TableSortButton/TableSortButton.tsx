import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

import { Button } from "../ui/button";

import type { Column } from "@tanstack/react-table";
import type React from "react";

interface SortButtonProps<T> {
  column: Column<T, unknown>;
  children: React.ReactNode;
}

const SortButton = <T,>({ column, children }: SortButtonProps<T>) => {
  const renderSortIcon = () => {
    const sortDirection = column.getIsSorted();

    if (sortDirection === "asc") {
      return <ArrowUp className="ml-2 size-4" />;
    }
    if (sortDirection === "desc") {
      return <ArrowDown className="ml-2 size-4" />;
    }
    return <ArrowUpDown className="ml-2 size-4" />;
  };

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="flex items-center p-0 hover:bg-transparent hover:text-primary-600"
    >
      {children}
      {renderSortIcon()}
    </Button>
  );
};

export default SortButton;
