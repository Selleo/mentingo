import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";
import {
  ANNOUNCEMENT_CARD_HANDLES,
  ANNOUNCEMENTS_PAGE_HANDLES,
  LATEST_ANNOUNCEMENTS_POPUP_HANDLES,
} from "~/modules/Announcements/handles";

import { expect, test } from "../../fixtures/test.fixture";

const ACCOUNT_PASSWORD = "Password123@";

test("student can read announcements from the popup", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `popup-student-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Popup",
    lastName: "Student",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });

  const title = `popup-announcement-${randomUUID().slice(0, 8)}`;
  const content = `popup-content-${randomUUID().slice(0, 8)}`;
  const createdAnnouncementResponse =
    await workspace.apiClient.api.announcementsControllerCreateAnnouncement({
      title,
      content,
      groupId: null,
    });
  const createdAnnouncement = createdAnnouncementResponse.data.data;

  await studentSession.page.goto(`${workspace.origin}/announcements`);

  await expect(
    studentSession.page.getByTestId(LATEST_ANNOUNCEMENTS_POPUP_HANDLES.ROOT),
  ).toBeVisible();
  await expect(
    studentSession.page.getByTestId(
      LATEST_ANNOUNCEMENTS_POPUP_HANDLES.card(createdAnnouncement.id),
    ),
  ).toBeVisible();

  await studentSession.page
    .getByTestId(LATEST_ANNOUNCEMENTS_POPUP_HANDLES.markAsReadButton(createdAnnouncement.id))
    .click();

  await expect(
    studentSession.page.getByTestId(LATEST_ANNOUNCEMENTS_POPUP_HANDLES.ROOT),
  ).toHaveCount(0);

  await expect
    .poll(async () => {
      const response =
        await studentSession.apiClient.api.announcementsControllerGetLatestUnreadAnnouncements();
      return response.data.data.length;
    })
    .toBe(0);
});

test("student can mark an announcement as read on the announcements page", async ({
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

  const firstTitle = `page-announcement-1-${randomUUID().slice(0, 8)}`;
  const firstContent = `page-content-1-${randomUUID().slice(0, 8)}`;
  const firstAnnouncementResponse =
    await workspace.apiClient.api.announcementsControllerCreateAnnouncement({
      title: firstTitle,
      content: firstContent,
      groupId: null,
    });
  const firstAnnouncement = firstAnnouncementResponse.data.data;

  await workspace.apiClient.api.announcementsControllerCreateAnnouncement({
    title: `page-announcement-2-${randomUUID().slice(0, 8)}`,
    content: `page-content-2-${randomUUID().slice(0, 8)}`,
    groupId: null,
  });

  await studentSession.page.goto(`${workspace.origin}/announcements`);
  await studentSession.page
    .getByTestId(ANNOUNCEMENTS_PAGE_HANDLES.PAGE)
    .waitFor({ state: "visible" });

  await expect(
    studentSession.page.getByTestId(ANNOUNCEMENT_CARD_HANDLES.card(firstAnnouncement.id)),
  ).toBeVisible();

  await studentSession.page
    .getByTestId(ANNOUNCEMENT_CARD_HANDLES.markAsReadButton(firstAnnouncement.id))
    .click();

  await expect
    .poll(async () => {
      const response =
        await studentSession.apiClient.api.announcementsControllerGetLatestUnreadAnnouncements();
      return response.data.data.length;
    })
    .toBe(1);
});
