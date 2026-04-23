import { expect } from "@playwright/test";

import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const selectEnrolledUsersFlow = async (page: Page, userIds: string[]) => {
  for (const userId of userIds) {
    const row = page.getByTestId(COURSE_ENROLLED_HANDLES.row(userId));

    await row.click();
    await expect(row).toHaveAttribute("data-state", "selected");
  }
};
