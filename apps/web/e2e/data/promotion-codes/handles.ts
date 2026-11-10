export const PROMOTION_CODES_PAGE_HANDLES = {
  PAGE: "promotion-codes-page",
  HEADING: "promotion-codes-page-heading",
  CREATE_BUTTON: "promotion-codes-page-create-button",
  SEARCH_INPUT: "promotion-codes-page-search-input",
  TABLE: "promotion-codes-page-table",
  TABLE_BODY: "promotion-codes-page-table-body",
  row: (promotionCodeId: string) => `promotion-codes-page-table-row-${promotionCodeId}`,
  EMPTY_STATE: "promotion-codes-page-empty-state",
} as const;
