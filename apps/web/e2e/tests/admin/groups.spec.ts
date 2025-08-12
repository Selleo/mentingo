import { test, expect, type Page } from "@playwright/test";

const GROUPS_PAGE_UI = {
  button: {
    groups: "groups",
    users: "users",
    createNew: "create new",
    publish: "publish",
    deleteSelected: "delete selected",
    delete: "delete",
    cancel: "cancel",
    save: "save",
    back: "back",
    edit: "edit",
    changeGroup: "Change group",
    confirm: "confirm",
  },
  cell: {
    selectRow: "Select row",
  },
  header: {
    groupHeader: "Groups",
    createGroupHeader: "Create new group",
    updateGroup: "Update group",
    usersHeader: "Users",
    userInformation: "User Information",
  },
  dataId: {
    groupName: "groupName",
    groupCharacteristic: "groupCharacteristic",
    firstUser: "contentcreator@example.com",
    secondUser: "student@example.com",
    groupSelect: "groupSelect",
  },
  expectedValues: {
    groupName: "Developer",
    groupCharacteristic: "Frontend developer",
    updatedGroupName: "Designer",
    updatedGroupCharacteristic: "UI/UX",
  },
};

const navigateToPage = async (page: Page, name: string, headerText: string) => {
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();

  const header = page.getByRole("heading").filter({ hasText: headerText });

  await expect(header).toHaveText(new RegExp(headerText, "i"));
};

const goIntoCreateMode = async (page: Page) => {
  await page
    .getByRole("button", { name: new RegExp(GROUPS_PAGE_UI.button.createNew, "i") })
    .click();

  const header = page
    .getByRole("heading")
    .filter({ hasText: GROUPS_PAGE_UI.header.createGroupHeader });

  await expect(header).toHaveText(new RegExp(GROUPS_PAGE_UI.header.createGroupHeader, "i"));
};

const fillAndAssertTextField = async (page: Page, testId: string, valueToFill: string) => {
  const field = page.getByTestId(testId);
  await field.fill(valueToFill);
  await expect(field).toHaveValue(valueToFill);
};

const findAndAssertCell = async (page: Page, expectedValue: string) => {
  const field = page.getByRole("cell", { name: new RegExp(expectedValue, "i") }).first();
  await expect(field).toHaveText(expectedValue);
};

const findAndClickCell = async (page: Page, name: string) => {
  await page
    .getByRole("cell", { name: new RegExp(name, "i") })
    .first()
    .click();
};

const findAndClickCheckbox = async (page: Page) => {
  const checkbox = page.getByLabel("Select row").first();

  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
};

const findAndClickButton = async (page: Page, name: string) =>
  await page
    .getByRole("button", { name: new RegExp(name, "i") })
    .first()
    .click();

const goIntoEditMode = async (page: Page) => {
  await findAndClickCell(page, GROUPS_PAGE_UI.expectedValues.groupName);

  const header = page.getByRole("heading", {
    name: new RegExp(GROUPS_PAGE_UI.header.updateGroup, "i"),
  });

  await expect(header).toHaveText(new RegExp(GROUPS_PAGE_UI.header.updateGroup, "i"));
};

const deleteAndAssert = async (page: Page, name: string) => {
  await findAndClickCheckbox(page);

  const deleteButton = page
    .getByRole("button", {
      name: new RegExp(GROUPS_PAGE_UI.button.deleteSelected, "i"),
    })
    .first();
  await expect(deleteButton).toBeEnabled({ timeout: 10000 });
  await deleteButton.click();

  await findAndClickButton(page, GROUPS_PAGE_UI.button.delete);

  const newCell = page.getByRole("cell", {
    name: new RegExp(name, "i"),
  });

  await page.waitForLoadState("networkidle");

  await expect(newCell).toHaveCount(0, { timeout: 15000 });
};

const editFields = async (
  page: Page,
  groupName: string,
  groupCharacteristic: string,
  groupNameId: string,
  groupCharacteristicId: string,
) => {
  await fillAndAssertTextField(page, groupNameId, groupName);
  await fillAndAssertTextField(page, groupCharacteristicId, groupCharacteristic);

  await findAndClickButton(page, GROUPS_PAGE_UI.button.publish);

  await findAndAssertCell(page, groupName);
  await findAndAssertCell(page, groupCharacteristic);
};

const createBasicGroup = async (page: Page) => {
  await goIntoCreateMode(page);
  await editFields(
    page,
    GROUPS_PAGE_UI.expectedValues.groupName,
    GROUPS_PAGE_UI.expectedValues.groupCharacteristic,
    GROUPS_PAGE_UI.dataId.groupName,
    GROUPS_PAGE_UI.dataId.groupCharacteristic,
  );
};

test.describe("Admin groups page flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.describe("Group CRUD", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToPage(page, GROUPS_PAGE_UI.button.groups, GROUPS_PAGE_UI.header.groupHeader);
    });

    test("should create a new group with characteristics", async ({ page }) => {
      await createBasicGroup(page);
      await deleteAndAssert(page, GROUPS_PAGE_UI.expectedValues.groupName);
    });

    test("should edit an existing group and then delete it", async ({ page }) => {
      await createBasicGroup(page);

      await goIntoEditMode(page);

      await editFields(
        page,
        GROUPS_PAGE_UI.expectedValues.updatedGroupName,
        GROUPS_PAGE_UI.expectedValues.updatedGroupCharacteristic,
        GROUPS_PAGE_UI.dataId.groupName,
        GROUPS_PAGE_UI.dataId.groupCharacteristic,
      );

      await deleteAndAssert(page, GROUPS_PAGE_UI.expectedValues.updatedGroupName);
    });

    test("should fail to edit group when inputting no data", async ({ page }) => {
      await createBasicGroup(page);

      await goIntoEditMode(page);

      await fillAndAssertTextField(page, GROUPS_PAGE_UI.dataId.groupName, "");
      await fillAndAssertTextField(page, GROUPS_PAGE_UI.dataId.groupCharacteristic, "");

      await findAndClickButton(page, GROUPS_PAGE_UI.button.publish);

      const errorText = page.getByText("Name must be at least 2");
      await expect(errorText).toBeVisible();

      await page
        .getByRole("button", { name: new RegExp(GROUPS_PAGE_UI.button.cancel, "i") })
        .click();

      await deleteAndAssert(page, GROUPS_PAGE_UI.expectedValues.groupName);
    });
  });

  test.describe("Assign groups to users", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToPage(page, GROUPS_PAGE_UI.button.groups, GROUPS_PAGE_UI.header.groupHeader);
      await createBasicGroup(page);
      await navigateToPage(page, GROUPS_PAGE_UI.button.users, GROUPS_PAGE_UI.header.usersHeader);
    });

    test.afterEach(async ({ page }) => {
      await page.goto("/");
      await navigateToPage(page, GROUPS_PAGE_UI.button.groups, GROUPS_PAGE_UI.header.groupHeader);
      await deleteAndAssert(page, GROUPS_PAGE_UI.expectedValues.groupName);
    });

    test("should assign one user to group", async ({ page }) => {
      await findAndClickCell(page, GROUPS_PAGE_UI.dataId.firstUser);

      const header = page.getByRole("heading", {
        name: new RegExp(GROUPS_PAGE_UI.header.userInformation, "i"),
      });
      await expect(header).toHaveText(GROUPS_PAGE_UI.header.userInformation);

      const groupSelector = page.getByTestId(GROUPS_PAGE_UI.dataId.groupSelect);
      await groupSelector.click();

      await page.locator(".p-1 > div > div").first().click();

      await expect(groupSelector).toHaveText(GROUPS_PAGE_UI.expectedValues.groupName);

      await findAndClickButton(page, GROUPS_PAGE_UI.button.save);
      await findAndClickButton(page, GROUPS_PAGE_UI.button.back);

      await findAndAssertCell(page, GROUPS_PAGE_UI.expectedValues.groupName);
    });

    test("should assign bulk users to group", async ({ page }) => {
      await page.getByTestId(GROUPS_PAGE_UI.dataId.firstUser).click();
      await page.getByTestId(GROUPS_PAGE_UI.dataId.secondUser).click();

      await findAndClickButton(page, GROUPS_PAGE_UI.button.edit);
      await findAndClickButton(page, GROUPS_PAGE_UI.button.changeGroup);

      const groupSelector = page.getByRole("combobox");
      await groupSelector.click();

      await page.locator(".p-1 > div > div").first().click();
      await expect(groupSelector).toHaveText(GROUPS_PAGE_UI.expectedValues.groupName);

      await findAndClickButton(page, GROUPS_PAGE_UI.button.save);
      await findAndClickButton(page, GROUPS_PAGE_UI.button.confirm);

      const cells = page.getByRole("cell", {
        name: new RegExp(GROUPS_PAGE_UI.expectedValues.groupName, "i"),
      });

      await expect(cells).toHaveCount(2);
    });
  });
});
