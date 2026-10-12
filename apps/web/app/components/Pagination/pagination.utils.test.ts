import { describe, expect, it } from "vitest";

import {
  ITEMS_PER_PAGE_OPTIONS,
  NEWS_ITEMS_PER_PAGE_OPTIONS,
  getFixedLengthPaginationRange,
  getItemsPerPageOptions,
  getPaginationRange,
  getPaginationState,
} from "./pagination.utils";

const describeRange = (currentPage: number, totalPages: number) =>
  getPaginationRange(currentPage, totalPages).map(({ page, isEllipsis }) =>
    isEllipsis ? `...${page}` : String(page),
  );

describe("getPaginationRange", () => {
  it("shows the neighbours of the first page and the last page", () => {
    expect(describeRange(1, 24)).toEqual(["1", "2", "...3", "24"]);
  });

  it("shows ellipses on both sides of a middle page", () => {
    expect(describeRange(10, 24)).toEqual(["1", "...8", "9", "10", "11", "...12", "24"]);
  });

  it("shows the first page and the neighbours of the last page", () => {
    expect(describeRange(24, 24)).toEqual(["1", "...22", "23", "24"]);
  });

  it("shows every page when there are only a few", () => {
    expect(describeRange(2, 3)).toEqual(["1", "2", "3"]);
  });
});

describe("getItemsPerPageOptions", () => {
  it("uses news options for news page sizes", () => {
    expect(getItemsPerPageOptions(7)).toBe(NEWS_ITEMS_PER_PAGE_OPTIONS);
  });

  it("uses default options otherwise", () => {
    expect(getItemsPerPageOptions(20)).toBe(ITEMS_PER_PAGE_OPTIONS);
  });
});

describe("getPaginationState", () => {
  it("derives pages and the item range from the totals", () => {
    expect(getPaginationState({ totalItems: 234, itemsPerPage: 10, currentPage: 24 })).toEqual({
      totalPages: 24,
      startItem: 231,
      endItem: 234,
      itemsPerPageOptions: ITEMS_PER_PAGE_OPTIONS,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  it("uses the overrides when they are given", () => {
    expect(
      getPaginationState({
        totalItems: 234,
        itemsPerPage: 10,
        currentPage: 1,
        overrideTotalPages: 3,
        startItemOverride: 5,
        endItemOverride: 8,
      }),
    ).toMatchObject({
      totalPages: 3,
      startItem: 5,
      endItem: 8,
      hasPreviousPage: false,
      hasNextPage: true,
    });
  });
});

describe("getFixedLengthPaginationRange", () => {
  const describeFixedRange = (currentPage: number, totalPages: number) =>
    getFixedLengthPaginationRange(currentPage, totalPages).map(({ page, isEllipsis }) =>
      isEllipsis ? `...${page}` : String(page),
    );

  it("shows every page when there are seven or fewer", () => {
    expect(describeFixedRange(2, 3)).toEqual(["1", "2", "3"]);
    expect(describeFixedRange(4, 7)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("shows the first five pages near the start", () => {
    expect(describeFixedRange(1, 24)).toEqual(["1", "2", "3", "4", "5", "...6", "24"]);
    expect(describeFixedRange(4, 24)).toEqual(["1", "2", "3", "4", "5", "...6", "24"]);
  });

  it("shows the current page with its neighbours in the middle", () => {
    expect(describeFixedRange(5, 24)).toEqual(["1", "...3", "4", "5", "6", "...7", "24"]);
    expect(describeFixedRange(20, 24)).toEqual(["1", "...18", "19", "20", "21", "...22", "24"]);
  });

  it("shows the last five pages near the end", () => {
    expect(describeFixedRange(21, 24)).toEqual(["1", "...19", "20", "21", "22", "23", "24"]);
    expect(describeFixedRange(24, 24)).toEqual(["1", "...19", "20", "21", "22", "23", "24"]);
  });

  it("keeps seven items on every page", () => {
    Array.from({ length: 24 }, (_, index) => index + 1).forEach((page) =>
      expect(getFixedLengthPaginationRange(page, 24)).toHaveLength(7),
    );
  });
});
