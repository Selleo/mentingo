import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";
import {
  ANNOUNCEMENT_CARD_HANDLES,
  ANNOUNCEMENTS_PAGE_HANDLES,
} from "~/modules/Announcements/handles";

import { expect, test } from "../../fixtures/test.fixture";

const ACCOUNT_PASSWORD = "Password123@";

test("group announcements stay hidden from users outside the group", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const groupFactory = workspace.factories.createGroupFactory();
  const group = await groupFactory.create({ name: `visibility-group-${randomUUID().slice(0, 8)}` });

  const memberSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `member-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Group",
    lastName: "Member",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });
  await workspace.apiClient.api.userControllerAdminUpdateUser(
    { id: memberSession.user.id },
    { groups: [group.id] },
  );

  const outsiderSession = await workspace.createTenantUserWithPasswordAndRole({
    email: `outsider-${randomUUID().slice(0, 8)}@example.com`,
    firstName: "Group",
    lastName: "Outsider",
    password: ACCOUNT_PASSWORD,
    role: USER_ROLE.student,
  });

  const createdAnnouncementResponse =
    await workspace.apiClient.api.announcementsControllerCreateAnnouncement({
      title: `visibility-announcement-${randomUUID().slice(0, 8)}`,
      content: `visibility-content-${randomUUID().slice(0, 8)}`,
      groupId: group.id,
    });
  const createdAnnouncement = createdAnnouncementResponse.data.data;

  await memberSession.page.goto(`${workspace.origin}/announcements`);
  await memberSession.page
    .getByTestId(ANNOUNCEMENTS_PAGE_HANDLES.PAGE)
    .waitFor({ state: "visible" });
  await expect(
    memberSession.page.getByTestId(ANNOUNCEMENT_CARD_HANDLES.card(createdAnnouncement.id)),
  ).toBeVisible();

  await outsiderSession.page.goto(`${workspace.origin}/announcements`);
  await outsiderSession.page
    .getByTestId(ANNOUNCEMENTS_PAGE_HANDLES.PAGE)
    .waitFor({ state: "visible" });
  await expect(
    outsiderSession.page.getByTestId(ANNOUNCEMENT_CARD_HANDLES.card(createdAnnouncement.id)),
  ).toHaveCount(0);
});
