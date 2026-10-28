import { describe, expect, it } from "vitest";

import { getHelpdeskPageKey, helpdeskTutorialPath } from "./helpdesk.helpers";

describe("safe Helpdesk context", () => {
  it("projects product page keys without forwarding resource IDs or raw URLs", () => {
    expect(getHelpdeskPageKey("/admin/beta-courses/private-id/authoring")).toBe(
      "admin.course.curriculum",
    );
    expect(getHelpdeskPageKey("/admin/development-paths/private-id")).toBe("development-paths");
    expect(getHelpdeskPageKey("/course/private-id/lesson/another-private-id")).toBe(
      "student.course",
    );
    expect(getHelpdeskPageKey("/admin/users/private-person")).toBeUndefined();
  });
  it("encodes stable identities in canonical Helpdesk links", () => {
    expect(helpdeskTutorialPath("course-authoring.publish", "review")).toBe(
      "/helpdesk/tutorials/course-authoring.publish?chapter=review",
    );
  });
});
