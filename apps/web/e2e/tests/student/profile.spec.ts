import { test, expect, type Page } from "@playwright/test";

const PROFILE_PAGE_UI = {
  button: {
    profile: "profile",
    edit: "edit",
    confirm: "confirm",
    delete: "Delete profile picture",
  },
  header: {
    profileHeader: "Profile",
  },
  dataId: {
    firstName: "firstName",
    lastName: "lastName",
    imageUpload: "imageUpload",
  },
  expectedValues: {
    firstName: "test",
    lastName: "Student",
  },
} as const;

const PROFILE_PAGE_FILE_PATH = "e2e/data/images/profile_icon_test.png";

const navigateToProfilePage = async (page: Page) => {
  await page.getByRole("button", { name: new RegExp(PROFILE_PAGE_UI.button.profile, "i") }).click();

  const header = page
    .getByRole("heading")
    .filter({ hasText: PROFILE_PAGE_UI.header.profileHeader });

  await expect(header).toHaveText(new RegExp(PROFILE_PAGE_UI.header.profileHeader, "i"));
};

const goIntoEditMode = async (page: Page) => {
  await page.getByRole("button", { name: new RegExp(PROFILE_PAGE_UI.button.edit, "i") }).click();
};

const confirmEditMode = async (page: Page) => {
  await page.getByRole("button", { name: new RegExp(PROFILE_PAGE_UI.button.confirm, "i") }).click();
};

const fillAndAssertTextField = async (page: Page, valueToFill: string, testId: string) => {
  const field = page.getByTestId(testId);
  await field.fill(valueToFill);
  await expect(field).toHaveValue(valueToFill);
};

const deleteProfilePicture = async (page: Page) => {
  await page.getByRole("button", { name: new RegExp(PROFILE_PAGE_UI.button.delete, "i") }).click();
};

const editUsername = async (page: Page) => {
  await goIntoEditMode(page);

  await fillAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.firstName,
    PROFILE_PAGE_UI.dataId.firstName,
  );

  await fillAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.lastName,
    PROFILE_PAGE_UI.dataId.lastName,
  );

  await confirmEditMode(page);

  const username = page.getByRole("heading", {
    name: new RegExp(
      `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName}`,
    ),
  });

  await expect(username).toHaveText(
    `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName}`,
  );
};

const editProfilePicture = async (page: Page) => {
  await goIntoEditMode(page);

  const uploadInput = page.getByTestId(PROFILE_PAGE_UI.dataId.imageUpload);

  await confirmEditMode(page);

  await goIntoEditMode(page);

  await uploadInput.setInputFiles(PROFILE_PAGE_FILE_PATH);
  await expect(uploadInput).not.toHaveValue("");

  await confirmEditMode(page);

  const profileImage = page.getByRole("img", {
    name: `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName} profile`,
  });

  await expect(profileImage).toBeVisible();
};

test.describe("Student profile page flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should edit username successfully", async ({ page }) => {
    await navigateToProfilePage(page);
    await editUsername(page);
  });

  test("should edit profile picture successfully", async ({ page }) => {
    await navigateToProfilePage(page);
    await editProfilePicture(page);
  });

  test("should delete profile picture without uploading new one", async ({ page }) => {
    await navigateToProfilePage(page);
    await goIntoEditMode(page);
    await deleteProfilePicture(page);
    await confirmEditMode(page);

    const profileImage = page.getByRole("img", {
      name: `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName} profile`,
    });
    await expect(profileImage).not.toBeVisible();
  });

  test("should preserve username when only editing profile picture", async ({ page }) => {
    await navigateToProfilePage(page);
    await editUsername(page);

    await goIntoEditMode(page);
    const uploadInput = page.getByTestId(PROFILE_PAGE_UI.dataId.imageUpload);
    await uploadInput.setInputFiles(PROFILE_PAGE_FILE_PATH);
    await confirmEditMode(page);

    const username = page.getByRole("heading", {
      name: new RegExp(
        `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName}`,
      ),
    });
    await expect(username).toBeVisible();
  });
});
