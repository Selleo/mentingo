import { ACTIVITY_LOG_RESOURCE_TYPES } from "@repo/shared";

import { getActivityLogMetadataResourceName } from "./get-activity-log-metadata-resource-name";

describe("getActivityLogMetadataResourceName", () => {
  it("prefers the after snapshot over older and contextual course names", () => {
    expect(
      getActivityLogMetadataResourceName(
        {
          after: { title: "Updated course" },
          before: { title: "Original course" },
          context: { courseTitle: "Context course" },
        },
        ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      ),
    ).toBe("Updated course");
  });

  it("uses resource-specific deletion context", () => {
    expect(
      getActivityLogMetadataResourceName(
        { context: { groupName: "Former group" } },
        ACTIVITY_LOG_RESOURCE_TYPES.GROUP,
      ),
    ).toBe("Former group");
  });

  it.each([
    [ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER, "chapterName", "Removed chapter"],
    [ACTIVITY_LOG_RESOURCE_TYPES.LESSON, "lessonName", "Removed lesson"],
    [ACTIVITY_LOG_RESOURCE_TYPES.QA, "qaTitle", "Removed question"],
  ])("uses the exact %s deletion field", (resourceType, field, name) => {
    expect(getActivityLogMetadataResourceName({ context: { [field]: name } }, resourceType)).toBe(
      name,
    );
  });

  it("does not infer a name from an unrelated context field", () => {
    expect(
      getActivityLogMetadataResourceName(
        { context: { lessonTitle: "Not persisted by the activity handler" } },
        ACTIVITY_LOG_RESOURCE_TYPES.LESSON,
      ),
    ).toBeNull();
  });

  it("combines a user's event-time first and last names", () => {
    expect(
      getActivityLogMetadataResourceName(
        { before: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" } },
        ACTIVITY_LOG_RESOURCE_TYPES.USER,
      ),
    ).toBe("Ada Lovelace");
  });

  it("returns null for metadata-free activity", () => {
    expect(getActivityLogMetadataResourceName(null, ACTIVITY_LOG_RESOURCE_TYPES.COURSE)).toBeNull();
  });
});
