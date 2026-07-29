import { PERMISSIONS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { canManageCourseByAuthor } from "./permission.utils";

describe("canManageCourseByAuthor", () => {
  it("allows any-course managers regardless of author", () => {
    expect(
      canManageCourseByAuthor({
        permissions: [PERMISSIONS.COURSE_UPDATE],
        courseAuthorId: "author-id",
        currentUserId: "other-user-id",
      }),
    ).toBe(true);
  });

  it("allows own-course managers only for their course", () => {
    expect(
      canManageCourseByAuthor({
        permissions: [PERMISSIONS.COURSE_UPDATE_OWN],
        courseAuthorId: "author-id",
        currentUserId: "author-id",
      }),
    ).toBe(true);

    expect(
      canManageCourseByAuthor({
        permissions: [PERMISSIONS.COURSE_UPDATE_OWN],
        courseAuthorId: "author-id",
        currentUserId: "other-user-id",
      }),
    ).toBe(false);
  });

  it("denies users without course-management permissions", () => {
    expect(
      canManageCourseByAuthor({
        permissions: [PERMISSIONS.COURSE_STATISTICS],
        courseAuthorId: "author-id",
        currentUserId: "author-id",
      }),
    ).toBe(false);
  });
});
