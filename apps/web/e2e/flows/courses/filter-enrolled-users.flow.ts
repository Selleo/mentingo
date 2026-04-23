import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";
import { closeMultiselectFlow } from "../users/close-multiselect.flow";

import type { Page } from "@playwright/test";

type FilterEnrolledUsersFlowInput = {
  keyword?: string;
  groupIds?: string[];
};

export const filterEnrolledUsersFlow = async (
  page: Page,
  { keyword, groupIds }: FilterEnrolledUsersFlowInput,
) => {
  if (keyword !== undefined) {
    const encodedKeyword = encodeURIComponent(keyword);
    const usersResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/course/") &&
        response.url().includes("/students") &&
        response.url().includes(`keyword=${encodedKeyword}`),
    );

    await page.getByTestId(COURSE_ENROLLED_HANDLES.SEARCH_INPUT).fill(keyword);
    await usersResponse;
  }

  if (groupIds?.length) {
    await page.getByTestId(COURSE_ENROLLED_HANDLES.GROUPS_FILTER).click();

    for (const groupId of groupIds) {
      await page.getByTestId(COURSE_ENROLLED_HANDLES.groupFilterOption(groupId)).click();
    }

    await closeMultiselectFlow(page, {
      closeTarget: page.getByTestId(COURSE_ENROLLED_HANDLES.SEARCH_INPUT),
    });
  }
};
