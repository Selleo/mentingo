import { FORUM_HANDLES } from "../../data/forum/handles";

import type { Page } from "@playwright/test";

export const replyToForumTopicFlow = async (page: Page, content: string) => {
  await page.getByTestId(FORUM_HANDLES.REPLY_INPUT).fill(content);
  await page.getByTestId(FORUM_HANDLES.REPLY_SUBMIT_BUTTON).click();
};
