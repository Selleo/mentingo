import { describe, expect, it } from "vitest";

import {
  getHelpdeskPageKey,
  helpdeskTutorialPath,
  readHelpdeskTutorialReference,
} from "./helpdesk.helpers";

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

  it("resolves same-tenant tutorial and chapter references", () => {
    expect(
      readHelpdeskTutorialReference(
        "/helpdesk/tutorials/course-authoring.publish?chapter=review",
        "https://tenant.example",
      ),
    ).toEqual({ key: "course-authoring.publish", chapterId: "review" });
    expect(
      readHelpdeskTutorialReference(
        "https://tenant.example/helpdesk/tutorials/course-authoring.publish",
        "https://tenant.example",
      ),
    ).toEqual({ key: "course-authoring.publish" });
  });

  it.each([
    "https://other.example/helpdesk/tutorials/example",
    "//other.example/helpdesk/tutorials/example",
    "https://user:secret@tenant.example/helpdesk/tutorials/example",
    "/helpdesk/tutorials/example?chapter=review&chapter=other",
    "/helpdesk/tutorials/example?videoUrl=https://other.example",
    "/helpdesk/tutorials/example#chapter",
    "/helpdesk/tutorials/example?chapter=../../private",
    "/helpdesk/tutorials/example/another",
  ])("rejects unsupported or foreign tutorial references: %s", (url) => {
    expect(readHelpdeskTutorialReference(url, "https://tenant.example")).toBeNull();
  });
});
