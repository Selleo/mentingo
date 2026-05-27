import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NOTIFICATIONS_HANDLES } from "../../data/announcements/handles";
import { expect, test } from "../../fixtures/test.fixture";

import { createAnnouncement } from "./announcement-test-helpers";

const ACCOUNT_PASSWORD = "Password123@";

test("admin-created announcement appears on the notifications page", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const title = `announcement-${randomUUID().slice(0, 8)}`;
  const content = `content-${title}`;

  const createdAnnouncement = await createAnnouncement(workspace.apiClient, {
    translations: [{ language: SUPPORTED_LANGUAGES.EN, title, content }],
  });

  await expect
    .poll(async () => {
      const response = await workspace.apiClient.api.announcementsControllerGetAllAnnouncements();
      return response.data.data.some((announcement) => announcement.title === title);
    })
    .toBe(true);

  await workspace.page.goto(`${workspace.origin}/notifications`);
  await expect(workspace.page.getByTestId(NOTIFICATIONS_HANDLES.PAGE)).toBeVisible();

  const createdCard = workspace.page.getByTestId(
    NOTIFICATIONS_HANDLES.card(createdAnnouncement.id),
  );
  await expect(createdCard.getByText(title, { exact: true })).toBeVisible();
  await expect(createdCard.getByText(content, { exact: true })).toBeVisible();
});

test("admin can create a localized announcement from the notification center", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const englishTitle = `ui-announcement-en-${randomUUID().slice(0, 8)}`;
  const englishContent = `ui-content-en-${randomUUID().slice(0, 8)}`;
  const germanTitle = `ui-announcement-de-${randomUUID().slice(0, 8)}`;
  const germanContent = `ui-content-de-${randomUUID().slice(0, 8)}`;

  await workspace.page.goto(`${workspace.origin}/notifications`);
  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_BUTTON).click();
  await expect(workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_DIALOG)).toBeVisible();

  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_TITLE_INPUT).fill(englishTitle);
  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_CONTENT_INPUT).fill(englishContent);

  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_LANGUAGE_SELECT).click();
  await workspace.page
    .getByTestId(NOTIFICATIONS_HANDLES.languageOption(SUPPORTED_LANGUAGES.DE))
    .click();
  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_TITLE_INPUT).fill(germanTitle);
  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_CONTENT_INPUT).fill(germanContent);
  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_SUBMIT_BUTTON).click();

  await expect(workspace.page.getByTestId(NOTIFICATIONS_HANDLES.CREATE_DIALOG)).toHaveCount(0);

  await expect
    .poll(async () => {
      const response = await workspace.apiClient.api.announcementsControllerGetAllAnnouncements({
        language: SUPPORTED_LANGUAGES.DE,
      });

      return response.data.data.some(
        (announcement) =>
          announcement.title === germanTitle && announcement.content === germanContent,
      );
    })
    .toBe(true);
});

test("admin can create a group announcement", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const groupFactory = workspace.factories.createGroupFactory();
  const group = await groupFactory.create({ name: `group-${randomUUID().slice(0, 8)}` });
  const targetEmail = `target-${randomUUID().slice(0, 8)}@example.com`;
  const outsiderEmail = `outsider-${randomUUID().slice(0, 8)}@example.com`;

  const targetSession = await workspace.createTenantUserWithPasswordAndRole({
    email: targetEmail,
    firstName: "Target",
    lastName: "Member",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });
  await workspace.apiClient.api.userControllerAdminUpdateUser(
    { id: targetSession.user.id },
    { groups: [group.id] },
  );

  const outsiderSession = await workspace.createTenantUserWithPasswordAndRole({
    email: outsiderEmail,
    firstName: "Outsider",
    lastName: "Member",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });

  const title = `group-announcement-${randomUUID().slice(0, 8)}`;
  const content = `group-content-${title}`;

  const createdAnnouncement = await createAnnouncement(workspace.apiClient, {
    groupId: group.id,
    translations: [{ language: SUPPORTED_LANGUAGES.EN, title, content }],
  });

  await targetSession.page.goto(`${workspace.origin}/notifications`);
  await targetSession.page.getByTestId(NOTIFICATIONS_HANDLES.PAGE).waitFor({ state: "visible" });
  const createdCard = targetSession.page.getByTestId(
    NOTIFICATIONS_HANDLES.card(createdAnnouncement.id),
  );
  await expect(createdCard.getByText(title, { exact: true })).toBeVisible();
  await expect(createdCard.getByText(content, { exact: true })).toBeVisible();

  await outsiderSession.page.goto(`${workspace.origin}/notifications`);
  await outsiderSession.page.getByTestId(NOTIFICATIONS_HANDLES.PAGE).waitFor({ state: "visible" });
  await expect(
    outsiderSession.page.getByTestId(NOTIFICATIONS_HANDLES.card(createdAnnouncement.id)),
  ).toHaveCount(0);
});

test("admin can delete an announcement from the notifications page", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const createdAnnouncement = await createAnnouncement(workspace.apiClient, {
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `delete-announcement-${randomUUID().slice(0, 8)}`,
        content: `delete-content-${randomUUID().slice(0, 8)}`,
      },
    ],
  });

  await workspace.page.goto(`${workspace.origin}/notifications`);
  await expect(
    workspace.page.getByTestId(NOTIFICATIONS_HANDLES.card(createdAnnouncement.id)),
  ).toBeVisible();

  await workspace.page
    .getByTestId(NOTIFICATIONS_HANDLES.deleteButton(createdAnnouncement.id))
    .click();
  await workspace.page.getByTestId(NOTIFICATIONS_HANDLES.DELETE_CONFIRM_BUTTON).click();

  await expect(
    workspace.page.getByTestId(NOTIFICATIONS_HANDLES.card(createdAnnouncement.id)),
  ).toHaveCount(0);
});
