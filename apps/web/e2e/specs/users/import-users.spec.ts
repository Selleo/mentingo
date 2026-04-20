import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { USERS_IMPORT_MODAL_HANDLES, USERS_PAGE_HANDLES } from "../../data/users/handles";
import {
  USERS_IMPORT_FILE_TEMPLATES,
  materializeUsersImportFile,
} from "../../data/users/import-users.data";
import { expect, test } from "../../fixtures/test.fixture";
import { openImportUsersModalFlow } from "../../flows/users/open-import-users-modal.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { submitImportUsersFlow } from "../../flows/users/submit-import-users.flow";
import { uploadUsersImportFileFlow } from "../../flows/users/upload-users-import-file.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";

test("admin can import users from csv and assign existing groups", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const groupFactory = factories.createGroupFactory();
    const prefix = `import-users-success-${Date.now()}`;
    const groupOne = await groupFactory.create({ name: `${prefix}-group-one` });
    const groupTwo = await groupFactory.create({ name: `${prefix}-group-two` });
    const importedStudentEmail = `${prefix}-student@example.com`;
    const importedCreatorEmail = `${prefix}-creator@example.com`;
    const importFile = await materializeUsersImportFile(USERS_IMPORT_FILE_TEMPLATES.SUCCESS, {
      EMAIL_ONE: importedStudentEmail,
      EMAIL_TWO: importedCreatorEmail,
      GROUP_ONE: groupOne.name,
      GROUP_TWO: groupTwo.name,
    });

    cleanup.add(async () => {
      await groupFactory.delete(groupOne.id);
    });
    cleanup.add(async () => {
      await groupFactory.delete(groupTwo.id);
    });
    cleanup.add(async () => {
      const importedUsers = await Promise.all([
        userFactory.getByEmail(importedStudentEmail),
        userFactory.getByEmail(importedCreatorEmail),
      ]);
      const importedUserIds: string[] = [];

      for (const importedUser of importedUsers) {
        if (importedUser) {
          importedUserIds.push(importedUser.id);
        }
      }

      await userFactory.deleteMany(importedUserIds);
    });
    cleanup.add(importFile.cleanup);

    await openUsersPageFlow(page);
    await openImportUsersModalFlow(page);
    await uploadUsersImportFileFlow(page, importFile.filePath);
    await submitImportUsersFlow(page);

    const importResult = page.getByTestId(USERS_IMPORT_MODAL_HANDLES.RESULT);

    await expect(importResult).toBeVisible();
    await expect(importResult.getByText(importedStudentEmail)).toBeVisible();
    await expect(importResult.getByText(importedCreatorEmail)).toBeVisible();

    await expect
      .poll(async () => {
        const [studentUser, creatorUser] = await Promise.all([
          userFactory.getByEmail(importedStudentEmail),
          userFactory.getByEmail(importedCreatorEmail),
        ]);

        if (!studentUser || !creatorUser) {
          return false;
        }

        return (
          studentUser.roleSlugs.includes(SYSTEM_ROLE_SLUGS.STUDENT) &&
          studentUser.groups.some((group) => group.id === groupOne.id) &&
          creatorUser.roleSlugs.includes(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR) &&
          creatorUser.groups.some((group) => group.id === groupOne.id) &&
          creatorUser.groups.some((group) => group.id === groupTwo.id)
        );
      })
      .toBe(true);

    await page.getByTestId(USERS_IMPORT_MODAL_HANDLES.RESULT_CLOSE).click();

    await expect(page.getByTestId(USERS_IMPORT_MODAL_HANDLES.RESULT)).not.toBeVisible();
    await expect(page.getByTestId(USERS_PAGE_HANDLES.HEADING)).toBeVisible();
  });
});

test("admin sees imported and skipped users when duplicates are present", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const groupFactory = factories.createGroupFactory();
    const prefix = `import-users-duplicate-${Date.now()}`;
    const group = await groupFactory.create({ name: `${prefix}-group` });
    const existingUser = await userFactory.create({
      email: `${prefix}-existing@example.com`,
    });
    const importedEmail = `${prefix}-new@example.com`;
    const importFile = await materializeUsersImportFile(USERS_IMPORT_FILE_TEMPLATES.DUPLICATE, {
      EXISTING_EMAIL: existingUser.email,
      NEW_EMAIL: importedEmail,
      GROUP_ONE: group.name,
    });

    cleanup.add(async () => {
      await groupFactory.delete(group.id);
    });
    cleanup.add(async () => {
      const importedUser = await userFactory.getByEmail(importedEmail);

      if (importedUser) {
        await userFactory.delete(importedUser.id);
      }
    });
    cleanup.add(async () => {
      await userFactory.delete(existingUser.id);
    });
    cleanup.add(importFile.cleanup);

    await openUsersPageFlow(page);
    await openImportUsersModalFlow(page);
    await uploadUsersImportFileFlow(page, importFile.filePath);
    await submitImportUsersFlow(page);

    const importResult = page.getByTestId(USERS_IMPORT_MODAL_HANDLES.RESULT);

    await expect(importResult).toBeVisible();
    await expect(importResult.getByText(importedEmail)).toBeVisible();

    await page.getByTestId(USERS_IMPORT_MODAL_HANDLES.RESULT_SKIPPED_TAB).click();
    await expect(importResult.getByText(existingUser.email)).toBeVisible();
    await expect(importResult.getByText("user with this email already exists")).toBeVisible();

    await expect
      .poll(async () => {
        const [duplicateUser, importedUser] = await Promise.all([
          userFactory.getByEmail(existingUser.email),
          userFactory.getByEmail(importedEmail),
        ]);

        return duplicateUser?.id === existingUser.id && importedUser !== null;
      })
      .toBe(true);
  });
});

test("admin sees an error when the import file is malformed", async ({
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `import-users-invalid-${Date.now()}`;
    const importFile = await materializeUsersImportFile(USERS_IMPORT_FILE_TEMPLATES.INVALID, {
      EMAIL_ONE: `${prefix}@example.com`,
      GROUP_ONE: `${prefix}-group`,
    });

    cleanup.add(importFile.cleanup);

    await openUsersPageFlow(page);
    await openImportUsersModalFlow(page);
    await uploadUsersImportFileFlow(page, importFile.filePath);
    await submitImportUsersFlow(page);

    await assertToastVisible(page, "Import failed – required data missing.", { optional: true });
    await expect(page.getByTestId(USERS_IMPORT_MODAL_HANDLES.RESULT)).toHaveCount(0);
    await expect(page.getByTestId(USERS_IMPORT_MODAL_HANDLES.ROOT)).toBeVisible();
  });
});

test("admin imports users even when groups do not exist", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const prefix = `import-users-unknown-groups-${Date.now()}`;
    const importedEmail = `${prefix}@example.com`;
    const importFile = await materializeUsersImportFile(
      USERS_IMPORT_FILE_TEMPLATES.UNKNOWN_GROUPS,
      {
        EMAIL_ONE: importedEmail,
        UNKNOWN_GROUP_ONE: `${prefix}-missing-one`,
        UNKNOWN_GROUP_TWO: `${prefix}-missing-two`,
      },
    );

    cleanup.add(importFile.cleanup);
    cleanup.add(async () => {
      const importedUser = await userFactory.getByEmail(importedEmail);

      if (importedUser) {
        await userFactory.delete(importedUser.id);
      }
    });

    await openUsersPageFlow(page);
    await openImportUsersModalFlow(page);
    await uploadUsersImportFileFlow(page, importFile.filePath);
    await submitImportUsersFlow(page);

    const importResult = page.getByTestId(USERS_IMPORT_MODAL_HANDLES.RESULT);

    await expect(importResult).toBeVisible();
    await expect(importResult.getByText(importedEmail)).toBeVisible();

    await expect
      .poll(async () => {
        const importedUser = await userFactory.getByEmail(importedEmail);

        if (!importedUser) {
          return false;
        }

        return (
          importedUser.roleSlugs.includes(SYSTEM_ROLE_SLUGS.STUDENT) &&
          importedUser.groups.length === 0
        );
      })
      .toBe(true);
  });
});
