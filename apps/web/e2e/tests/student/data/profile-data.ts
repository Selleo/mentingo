export const PROFILE_PAGE_UI = {
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

export const PROFILE_PAGE_FILE_PATH = "e2e/data/images/profile_icon_test.png";
