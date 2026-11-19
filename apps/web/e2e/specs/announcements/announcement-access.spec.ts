import { randomUUID } from "node:crypto";

import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NOTIFICATIONS_HANDLES } from "../../data/announcements/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createAnnouncementFlow } from "../../flows/announcements/create-announcement.flow";

test("a group announcement reaches group members only", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const group = await workspace.factories.createGroupFactory().create();
  const member = await workspace.createTenantUserWithPasswordAndRole({ role: USER_ROLE.student });
  await workspace.factories.createUserFactory().update(member.user.id, { groups: [group.id] });
  const outsider = await workspace.createTenantUserWithPasswordAndRole({
    role: USER_ROLE.student,
  });
  const title = `group-announcement-${randomUUID().slice(0, 8)}`;
  const content = `group-content-${title}`;

  await workspace.page.goto(`${workspace.origin}/notifications`);
  await createAnnouncementFlow(workspace.page, {
    groupId: group.id,
    translations: [{ language: SUPPORTED_LANGUAGES.EN, title, content }],
  });

  const announcementFactory = workspace.factories.createAnnouncementFactory();
  const tenantWideAnnouncement = await announcementFactory.create();
  let announcementId = "";
  await expect
    .poll(async () => {
      announcementId = (await announcementFactory.findByTitle(title))?.id ?? "";
      return announcementId;
    })
    .not.toBe("");

  await member.page.goto(`${workspace.origin}/notifications`);
  const memberCard = member.page.getByTestId(NOTIFICATIONS_HANDLES.card(announcementId));
  await expect(memberCard.getByTestId(NOTIFICATIONS_HANDLES.CARD_TITLE)).toHaveText(title);
  await expect(memberCard.getByTestId(NOTIFICATIONS_HANDLES.CARD_CONTENT)).toHaveText(content);

  await outsider.page.goto(`${workspace.origin}/notifications`);
  // The tenant-wide announcement proves the outsider's list has loaded before the negative check.
  await expect(
    outsider.page.getByTestId(NOTIFICATIONS_HANDLES.card(tenantWideAnnouncement.id)),
  ).toBeVisible();
  await expect(outsider.page.getByTestId(NOTIFICATIONS_HANDLES.card(announcementId))).toHaveCount(
    0,
  );
});
