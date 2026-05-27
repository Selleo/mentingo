import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NOTIFICATIONS_HANDLES } from "../../data/announcements/handles";
import { expect, test } from "../../fixtures/test.fixture";

import { createAnnouncement } from "./announcement-test-helpers";

const ACCOUNT_PASSWORD = "Password123@";

test("student can read an announcement from the notifications popover", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `popover-student-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Popover",
    lastName: "Student",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });

  const title = `popover-announcement-${randomUUID().slice(0, 8)}`;
  const content = `popover-content-${randomUUID().slice(0, 8)}`;
  const createdAnnouncement = await createAnnouncement(workspace.apiClient, {
    translations: [{ language: SUPPORTED_LANGUAGES.EN, title, content }],
  });

  await studentSession.page.goto(`${workspace.origin}/progress`);
  await studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.TRIGGER).click();

  const popover = studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.POPOVER);
  await expect(popover).toBeVisible();
  await expect(
    popover.getByTestId(NOTIFICATIONS_HANDLES.card(createdAnnouncement.id)),
  ).toBeVisible();

  await popover.getByTestId(NOTIFICATIONS_HANDLES.markReadButton(createdAnnouncement.id)).click();

  await expect
    .poll(async () => {
      const response =
        await studentSession.apiClient.api.announcementsControllerGetUnreadAnnouncementsCount();
      return response.data.data.unreadCount;
    })
    .toBe(0);
});

test("student can open the notification center from the popover", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `center-student-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Center",
    lastName: "Student",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });

  const createdAnnouncement = await createAnnouncement(workspace.apiClient, {
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `center-announcement-${randomUUID().slice(0, 8)}`,
        content: `center-content-${randomUUID().slice(0, 8)}`,
      },
    ],
  });

  await studentSession.page.goto(`${workspace.origin}/progress`);
  await studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.TRIGGER).click();

  const notificationCenterLink = studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.CENTER_LINK);
  await expect(notificationCenterLink).toHaveAttribute("href", "/notifications");

  await studentSession.page.goto(`${workspace.origin}/notifications`);
  await expect(studentSession.page).toHaveURL(/\/notifications$/);
  await expect(studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.PAGE)).toBeVisible();
  await expect(
    studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.card(createdAnnouncement.id)),
  ).toBeVisible();
});

test("student can mark one announcement as read on the notifications page", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `page-student-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Page",
    lastName: "Student",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });

  const firstAnnouncement = await createAnnouncement(workspace.apiClient, {
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `page-announcement-1-${randomUUID().slice(0, 8)}`,
        content: `page-content-1-${randomUUID().slice(0, 8)}`,
      },
    ],
  });

  await createAnnouncement(workspace.apiClient, {
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `page-announcement-2-${randomUUID().slice(0, 8)}`,
        content: `page-content-2-${randomUUID().slice(0, 8)}`,
      },
    ],
  });

  await studentSession.page.goto(`${workspace.origin}/notifications`);
  await studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.PAGE).waitFor({ state: "visible" });

  await expect(
    studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.card(firstAnnouncement.id)),
  ).toBeVisible();

  await studentSession.page
    .getByTestId(NOTIFICATIONS_HANDLES.markReadButton(firstAnnouncement.id))
    .click();

  await expect
    .poll(async () => {
      const response =
        await studentSession.apiClient.api.announcementsControllerGetUnreadAnnouncementsCount();
      return response.data.data.unreadCount;
    })
    .toBe(1);
});

test("student can mark all announcements as read on the notifications page", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `mark-all-student-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Mark",
    lastName: "All",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });

  await createAnnouncement(workspace.apiClient, {
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `mark-all-announcement-1-${randomUUID().slice(0, 8)}`,
        content: `mark-all-content-1-${randomUUID().slice(0, 8)}`,
      },
    ],
  });
  await createAnnouncement(workspace.apiClient, {
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `mark-all-announcement-2-${randomUUID().slice(0, 8)}`,
        content: `mark-all-content-2-${randomUUID().slice(0, 8)}`,
      },
    ],
  });

  await studentSession.page.goto(`${workspace.origin}/notifications`);
  const markAllButton = studentSession.page.getByTestId(NOTIFICATIONS_HANDLES.MARK_ALL_READ_BUTTON);
  await expect(markAllButton).toBeEnabled();
  await markAllButton.click();

  await expect
    .poll(async () => {
      const response =
        await studentSession.apiClient.api.announcementsControllerGetUnreadAnnouncementsCount();
      return response.data.data.unreadCount;
    })
    .toBe(0);
});

test("notifications page loads the next announcement page", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const createdAnnouncements = [];

  for (let index = 0; index < 21; index += 1) {
    const announcement = await createAnnouncement(workspace.apiClient, {
      translations: [
        {
          language: SUPPORTED_LANGUAGES.EN,
          title: `infinite-announcement-${index}-${randomUUID().slice(0, 8)}`,
          content: `infinite-content-${index}-${randomUUID().slice(0, 8)}`,
        },
      ],
    });
    createdAnnouncements.push(announcement);
  }

  const oldestAnnouncement = createdAnnouncements[0];

  await workspace.page.goto(`${workspace.origin}/notifications`);
  await expect(
    workspace.page.getByTestId(NOTIFICATIONS_HANDLES.card(oldestAnnouncement.id)),
  ).toHaveCount(0);

  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.LOAD_MORE_BUTTON).click();

  await expect(
    workspace.page.getByTestId(NOTIFICATIONS_HANDLES.card(oldestAnnouncement.id)),
  ).toBeVisible();
});

test("student sees announcement content in the current UI language", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `localized-student-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Localized",
    lastName: "Student",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });
  const englishTitle = `localized-en-${randomUUID().slice(0, 8)}`;
  const englishContent = `localized-content-en-${randomUUID().slice(0, 8)}`;
  const germanTitle = `localized-de-${randomUUID().slice(0, 8)}`;
  const germanContent = `localized-content-de-${randomUUID().slice(0, 8)}`;

  const createdAnnouncement = await createAnnouncement(workspace.apiClient, {
    translations: [
      { language: SUPPORTED_LANGUAGES.EN, title: englishTitle, content: englishContent },
      { language: SUPPORTED_LANGUAGES.DE, title: germanTitle, content: germanContent },
    ],
  });

  await studentSession.apiClient.api.settingsControllerUpdateUserSettings({
    language: SUPPORTED_LANGUAGES.DE,
  });

  await studentSession.page.goto(`${workspace.origin}/notifications`);

  const createdCard = studentSession.page.getByTestId(
    NOTIFICATIONS_HANDLES.card(createdAnnouncement.id),
  );
  await expect(createdCard.getByText(germanTitle, { exact: true })).toBeVisible();
  await expect(createdCard.getByText(germanContent, { exact: true })).toBeVisible();
  await expect(createdCard.getByText(englishTitle, { exact: true })).toHaveCount(0);
});
