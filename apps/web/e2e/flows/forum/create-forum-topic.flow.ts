import { expect, type Page } from "@playwright/test";

import { FORUM_HANDLES } from "../../data/forum/handles";

export const createForumTopicFlow = async (
  page: Page,
  topic: { title: string; content: string },
) => {
  await page.getByTestId(FORUM_HANDLES.NEW_TOPIC_BUTTON).click();
  await expect(page.getByTestId(FORUM_HANDLES.CREATE_DIALOG)).toBeVisible();
  await page.getByTestId(FORUM_HANDLES.TITLE_INPUT).fill(topic.title);
  await page.getByTestId(FORUM_HANDLES.CONTENT_INPUT).fill(topic.content);
  await page.getByTestId(FORUM_HANDLES.CREATE_SUBMIT_BUTTON).click();
  await expect(page.getByTestId(FORUM_HANDLES.TOPIC_PAGE)).toBeVisible();
};
