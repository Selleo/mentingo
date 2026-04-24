import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";
import {
  ANNOUNCEMENT_CARD_HANDLES,
  ANNOUNCEMENTS_PAGE_HANDLES,
} from "~/modules/Announcements/handles";

import { expect, test } from "../../fixtures/test.fixture";

test("admin can create an announcement", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const title = `announcement-${randomUUID().slice(0, 8)}`;
  const content = `content-${title}`;

  const createdAnnouncementResponse =
    await workspace.apiClient.api.announcementsControllerCreateAnnouncement({
      title,
      content,
      groupId: null,
    });
  const createdAnnouncement = createdAnnouncementResponse.data.data;

  await expect
    .poll(async () => {
      const response = await workspace.apiClient.api.announcementsControllerGetAllAnnouncements();
      return response.data.data.some((announcement) => announcement.title === title);
    })
    .toBe(true);

  await workspace.page.goto(`${workspace.origin}/announcements`);
  await expect(workspace.page.getByTestId(ANNOUNCEMENTS_PAGE_HANDLES.PAGE)).toBeVisible();
  const createdCard = workspace.page.getByTestId(
    ANNOUNCEMENT_CARD_HANDLES.card(createdAnnouncement.id),
  );
  await expect(createdCard.getByRole("heading", { name: title })).toBeVisible();
  await expect(createdCard.getByText(content, { exact: true })).toBeVisible();
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
    password: "Password123@",
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
    password: "Password123@",
    role: USER_ROLE.student,
  });

  const title = `group-announcement-${randomUUID().slice(0, 8)}`;
  const content = `group-content-${title}`;

  const createdAnnouncementResponse =
    await workspace.apiClient.api.announcementsControllerCreateAnnouncement({
      title,
      content,
      groupId: group.id,
    });
  const createdAnnouncement = createdAnnouncementResponse.data.data;

  await targetSession.page.goto(`${workspace.origin}/announcements`);
  await targetSession.page
    .getByTestId(ANNOUNCEMENTS_PAGE_HANDLES.PAGE)
    .waitFor({ state: "visible" });
  const createdCard = targetSession.page.getByTestId(
    ANNOUNCEMENT_CARD_HANDLES.card(createdAnnouncement.id),
  );
  await expect(createdCard.getByRole("heading", { name: title })).toBeVisible();
  await expect(createdCard.getByText(content, { exact: true })).toBeVisible();

  await outsiderSession.page.goto(`${workspace.origin}/announcements`);
  await outsiderSession.page
    .getByTestId(ANNOUNCEMENTS_PAGE_HANDLES.PAGE)
    .waitFor({ state: "visible" });
  await expect(
    outsiderSession.page.getByTestId(ANNOUNCEMENT_CARD_HANDLES.card(createdAnnouncement.id)),
  ).toHaveCount(0);
});
