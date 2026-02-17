import { getTenantEmail } from "../../../utils/tenant-email";

export const GROUPS_PAGE_UI = {
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
    modifyGroups: "Modify groups (2)",
  },
  dataId: {
    groupName: "groupName",
    groupCharacteristic: "groupCharacteristic",
    firstUser: getTenantEmail("contentcreator@example.com"),
    secondUser: getTenantEmail("student@example.com"),
    groupSelect: "groupSelect",
  },
  placeholder: {
    selectGroup: "Select groups",
  },
  expectedValues: {
    groupName: "Developer",
    groupCharacteristic: "Frontend developer",
    updatedGroupName: "Designer",
    updatedGroupCharacteristic: "UI/UX",
  },
};
