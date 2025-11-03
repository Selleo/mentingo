import type { SortingState } from "@tanstack/react-table";

export const tanstackSortingToParam = (sorting: SortingState) => {
  if (sorting.length === 0) return undefined;
  const sortingParams = sorting
    .map((sort) => {
      const isDesc = sort.desc;
      const field = sort.id;
      return `${isDesc ? "-" : ""}${field}`;
    })
    .join(",");
  return sortingParams;
};
