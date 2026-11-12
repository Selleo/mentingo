import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";
import { waitForSearchParam } from "../../utils/wait-for-search-param";

import type { Page } from "@playwright/test";

/** Narrows the groups list to a keyword, so groups created by a test are on the first page. */
export const filterGroupsFlow = async (page: Page, keyword: string) => {
  await page.getByTestId(GROUPS_PAGE_HANDLES.SEARCH_INPUT).fill(keyword);
  await waitForSearchParam(page, "search", keyword);
};
