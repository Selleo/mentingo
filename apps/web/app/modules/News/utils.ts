export const ITEMS_ON_FIRST_PAGE = 7;
export const ITEMS_ON_OTHER_PAGES = 9;

export const getPaginationData = (totalItems: number, currentPage: number) => {
  if (totalItems <= ITEMS_ON_FIRST_PAGE) {
    return {
      totalPages: 1,
      itemsPerPage: ITEMS_ON_FIRST_PAGE,
      startItem: 1,
      endItem: totalItems,
    };
  }

  const remainingItems = totalItems - ITEMS_ON_FIRST_PAGE;
  const additionalPages = Math.ceil(remainingItems / ITEMS_ON_OTHER_PAGES);
  const computedTotalPages = 1 + additionalPages;

  const isFirstPage = currentPage === 1;
  const pageItemsPerPage = isFirstPage ? ITEMS_ON_FIRST_PAGE : ITEMS_ON_OTHER_PAGES;
  const offset = isFirstPage ? 0 : ITEMS_ON_FIRST_PAGE + (currentPage - 2) * ITEMS_ON_OTHER_PAGES;
  const pageStart = offset + 1;
  const pageEnd = Math.min(offset + pageItemsPerPage, totalItems);

  return {
    totalPages: computedTotalPages,
    itemsPerPage: pageItemsPerPage,
    startItem: pageStart,
    endItem: pageEnd,
  };
};
