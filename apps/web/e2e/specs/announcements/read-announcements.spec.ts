import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NOTIFICATIONS_HANDLES } from "../../data/announcements/handles";
import { expect, test } from "../../fixtures/test.fixture";

test("student reads an announcement from the popover and opens the notification center", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const student = await workspace.createTenantUserWithPasswordAndRole({ role: USER_ROLE.student });
  const announcement = await workspace.factories.createAnnouncementFactory().create();
  const unreadBadge = student.page
    .getByTestId(NOTIFICATIONS_HANDLES.TRIGGER)
    .getByTestId(NOTIFICATIONS_HANDLES.UNREAD_BADGE);

  await student.page.goto(`${workspace.origin}/dashboard`);
  await expect(unreadBadge).toHaveText("1");
  await student.page.getByTestId(NOTIFICATIONS_HANDLES.TRIGGER).click();

  const popover = student.page.getByTestId(NOTIFICATIONS_HANDLES.POPOVER);
  await expect(popover.getByTestId(NOTIFICATIONS_HANDLES.card(announcement.id))).toBeVisible();
  await popover.getByTestId(NOTIFICATIONS_HANDLES.markReadButton(announcement.id)).click();

  await expect(unreadBadge).toHaveCount(0);
  await expect(
    popover.getByTestId(NOTIFICATIONS_HANDLES.markReadButton(announcement.id)),
  ).toHaveCount(0);

  await student.page.getByTestId(NOTIFICATIONS_HANDLES.CENTER_LINK).click();
  await expect(student.page).toHaveURL(/\/notifications$/);
  await expect(
    student.page
      .getByTestId(NOTIFICATIONS_HANDLES.PAGE)
      .getByTestId(NOTIFICATIONS_HANDLES.card(announcement.id)),
  ).toBeVisible();
});

test("student marks announcements as read one by one and all at once", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const student = await workspace.createTenantUserWithPasswordAndRole({ role: USER_ROLE.student });
  const [firstAnnouncement] = await workspace.factories.createAnnouncementFactory().createMany(3);
  const unreadBadge = student.page
    .getByTestId(NOTIFICATIONS_HANDLES.TRIGGER)
    .getByTestId(NOTIFICATIONS_HANDLES.UNREAD_BADGE);

  await student.page.goto(`${workspace.origin}/notifications`);
  await expect(unreadBadge).toHaveText("3");

  await student.page
    .getByTestId(NOTIFICATIONS_HANDLES.markReadButton(firstAnnouncement.id))
    .click();
  await expect(unreadBadge).toHaveText("2");

  const markAllButton = student.page.getByTestId(NOTIFICATIONS_HANDLES.MARK_ALL_READ_BUTTON);
  await markAllButton.click();
  await expect(unreadBadge).toHaveCount(0);
  await expect(markAllButton).toBeDisabled();
});

test("notifications page loads the next announcement page", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const [oldestAnnouncement] = await workspace.factories.createAnnouncementFactory().createMany(21);
  const oldestCard = workspace.page.getByTestId(NOTIFICATIONS_HANDLES.card(oldestAnnouncement.id));

  await workspace.page.goto(`${workspace.origin}/notifications`);
  await expect(workspace.page.getByTestId(NOTIFICATIONS_HANDLES.LOAD_MORE_BUTTON)).toBeVisible();
  await expect(oldestCard).toHaveCount(0);

  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.LOAD_MORE_BUTTON).click();

  await expect(oldestCard).toBeVisible();
});

test("student sees announcement content in the current UI language", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const student = await workspace.createTenantUserWithPasswordAndRole({ role: USER_ROLE.student });
  const suffix = randomUUID().slice(0, 8);
  const germanTitle = `localized-de-${suffix}`;
  const germanContent = `localized-content-de-${suffix}`;
  const announcement = await workspace.factories.createAnnouncementFactory().create({
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `localized-en-${suffix}`,
        content: `localized-content-en-${suffix}`,
      },
      { language: SUPPORTED_LANGUAGES.DE, title: germanTitle, content: germanContent },
    ],
  });

  await student.apiClient.api.settingsControllerUpdateUserSettings({
    language: SUPPORTED_LANGUAGES.DE,
  });
  await student.page.goto(`${workspace.origin}/notifications`);

  const card = student.page.getByTestId(NOTIFICATIONS_HANDLES.card(announcement.id));
  await expect(card.getByTestId(NOTIFICATIONS_HANDLES.CARD_TITLE)).toHaveText(germanTitle);
  await expect(card.getByTestId(NOTIFICATIONS_HANDLES.CARD_CONTENT)).toHaveText(germanContent);
});
