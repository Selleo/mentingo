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
    username: "username",
    firstName: "firstName",
    lastName: "lastName",
    contactEmail: "contactEmail",
    contactPhone: "contactPhone",
    jobTitle: "jobTitle",
    description: "description",
    imageUpload: "imageUpload",
  },
  expectedValues: {
    firstName: "Test",
    lastName: "Admin",
    contactEmail: "testAdmin@example.com",
    contactPhone: "123456789",
    jobTitle: "Administrator",
    description: "Great person",
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

const findAndAssertTextField = async (page: Page, expectedValue: string, testId: string) => {
  const field = page.getByTestId(testId);
  await expect(field).toHaveText(expectedValue);
};

const editAllTextFields = async (page: Page) => {
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

  await fillAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.contactEmail,
    PROFILE_PAGE_UI.dataId.contactEmail,
  );

  await fillAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.contactPhone,
    PROFILE_PAGE_UI.dataId.contactPhone,
  );

  await fillAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.jobTitle,
    PROFILE_PAGE_UI.dataId.jobTitle,
  );

  await fillAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.description,
    PROFILE_PAGE_UI.dataId.description,
  );

  await confirmEditMode(page);

  await findAndAssertTextField(
    page,
    `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName}`,
    PROFILE_PAGE_UI.dataId.username,
  );

  await findAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.description,
    PROFILE_PAGE_UI.dataId.description,
  );

  await findAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.jobTitle,
    PROFILE_PAGE_UI.dataId.jobTitle,
  );

  await findAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.contactEmail,
    PROFILE_PAGE_UI.dataId.contactEmail,
  );

  await findAndAssertTextField(
    page,
    PROFILE_PAGE_UI.expectedValues.contactPhone,
    PROFILE_PAGE_UI.dataId.contactPhone,
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

  const profileImage = page
    .locator("section")
    .filter({
      hasText: `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName}Title:`,
    })
    .getByRole("img", {
      name: `${PROFILE_PAGE_UI.expectedValues.firstName} ${PROFILE_PAGE_UI.expectedValues.lastName} profile`,
    });

  await expect(profileImage).toBeVisible();
};

test.describe("Admin profile page flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should edit all text fields successfully", async ({ page }) => {
    await navigateToProfilePage(page);
    await editAllTextFields(page);
  });

  test("should edit profile picture successfully", async ({ page }) => {
    await navigateToProfilePage(page);
    await editProfilePicture(page);
  });
});
