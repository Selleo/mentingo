import { expect, type Page } from "@playwright/test";

import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";

export const filterTenantsFlow = async (page: Page, search: string) => {
  const tableContainer = page.getByTestId(TENANTS_PAGE_HANDLES.TABLE_CONTAINER);
  const filteredTenantsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      response.request().method() === "GET" &&
      url.pathname.endsWith("/api/super-admin/tenants") &&
      url.searchParams.get("search") === search
    );
  });

  await page.getByTestId(TENANTS_PAGE_HANDLES.SEARCH_INPUT).fill(search);
  expect((await filteredTenantsResponse).ok()).toBe(true);
  await expect(tableContainer).toHaveAttribute("aria-busy", "false");
};
