import { useEffect } from "react";

type UseClampedPageOptions = {
  page: number;
  perPage: number;
  totalItems: number | undefined;
  setPage: (page: number) => void;
};

/** A page can disappear after deletions or archiving; land on the last page that still exists. */
export function useClampedPage({ page, perPage, totalItems, setPage }: UseClampedPageOptions) {
  const lastPage =
    totalItems === undefined ? undefined : Math.max(1, Math.ceil(totalItems / perPage));

  useEffect(() => {
    if (lastPage !== undefined && page > lastPage) setPage(lastPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lastPage]);
}
