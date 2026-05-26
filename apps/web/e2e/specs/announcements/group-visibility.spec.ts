import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NOTIFICATIONS_HANDLES } from "../../data/announcements/handles";
import { expect, test } from "../../fixtures/test.fixture";

import { createAnnouncement } from "./announcement-test-helpers";

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

  const createdAnnouncement = await createAnnouncement(workspace.apiClient, {
    groupId: group.id,
    translations: [
      {
        language: SUPPORTED_LANGUAGES.EN,
        title: `visibility-announcement-${randomUUID().slice(0, 8)}`,
        content: `visibility-content-${randomUUID().slice(0, 8)}`,
      },
    ],
  });

  await memberSession.page.goto(`${workspace.origin}/notifications`);
  await memberSession.page.getByTestId(NOTIFICATIONS_HANDLES.PAGE).waitFor({ state: "visible" });
  await expect(
    memberSession.page.getByTestId(NOTIFICATIONS_HANDLES.card(createdAnnouncement.id)),
  ).toBeVisible();

  await outsiderSession.page.goto(`${workspace.origin}/notifications`);
  await outsiderSession.page.getByTestId(NOTIFICATIONS_HANDLES.PAGE).waitFor({ state: "visible" });
  await expect(
    outsiderSession.page.getByTestId(NOTIFICATIONS_HANDLES.card(createdAnnouncement.id)),
  ).toHaveCount(0);
});
