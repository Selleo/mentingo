import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NOTIFICATIONS_HANDLES } from "../../data/announcements/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createAnnouncementFlow } from "../../flows/announcements/create-announcement.flow";

test("admin can create a localized announcement in the notification center and delete it", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const announcementFactory = workspace.factories.createAnnouncementFactory();
  const { page } = workspace;
  const suffix = randomUUID().slice(0, 8);
  const english = {
    language: SUPPORTED_LANGUAGES.EN,
    title: `announcement-en-${suffix}`,
    content: `announcement-content-en-${suffix}`,
  };
  const german = {
    language: SUPPORTED_LANGUAGES.DE,
    title: `announcement-de-${suffix}`,
    content: `announcement-content-de-${suffix}`,
  };

  await page.goto(`${workspace.origin}/notifications`);
  await createAnnouncementFlow(page, { translations: [english, german] });

  let announcementId = "";
  await expect
    .poll(async () => {
      announcementId = (await announcementFactory.findByTitle(english.title))?.id ?? "";
      return announcementId;
    })
    .not.toBe("");
  await expect
    .poll(async () => (await announcementFactory.findByTitle(german.title, german.language))?.id)
    .toBe(announcementId);

  const card = page.getByTestId(NOTIFICATIONS_HANDLES.card(announcementId));
  await expect(card.getByTestId(NOTIFICATIONS_HANDLES.CARD_TITLE)).toHaveText(english.title);
  await expect(card.getByTestId(NOTIFICATIONS_HANDLES.CARD_CONTENT)).toHaveText(english.content);

  await page.getByTestId(NOTIFICATIONS_HANDLES.TAB_ADMIN_ANNOUNCEMENTS).click();
  await expect(card).toBeVisible();
  await page.getByTestId(NOTIFICATIONS_HANDLES.TAB_SYSTEM).click();
  await expect(card).toHaveCount(0);
  await page.getByTestId(NOTIFICATIONS_HANDLES.TAB_ALL).click();
  await expect(card).toBeVisible();

  await page.getByTestId(NOTIFICATIONS_HANDLES.deleteButton(announcementId)).click();
  await page.getByTestId(NOTIFICATIONS_HANDLES.DELETE_CONFIRM_BUTTON).click();

  await expect(card).toHaveCount(0);
  await expect.poll(() => announcementFactory.findByTitle(english.title)).toBeUndefined();
});
