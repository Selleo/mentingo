import { MAX_COURSE_AUTHORING_SOURCE_SIZE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { buildAuthoringTargets, getCourseAuthoringSourceError } from "./AuthoringBriefPanel";

import type { CourseContext } from "../courseAuthoring.types";

describe("course authoring source upload validation", () => {
  it("accepts the supported authoring source formats", () => {
    expect(
      getCourseAuthoringSourceError(new File(["course"], "course.md", { type: "text/markdown" })),
    ).toBeNull();
    expect(
      getCourseAuthoringSourceError(
        new File(["course"], "course.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ),
    ).toBeNull();
  });

  it("rejects legacy DOC, unsupported files and sources over 25 MiB", () => {
    expect(
      getCourseAuthoringSourceError(
        new File(["legacy"], "legacy.doc", { type: "application/msword" }),
      ),
    ).toBe("courseAuthoring.sources.unsupportedFile");
    expect(
      getCourseAuthoringSourceError(
        new File(["archive"], "course.zip", { type: "application/zip" }),
      ),
    ).toBe("courseAuthoring.sources.unsupportedFile");

    const oversized = new File(["x"], "course.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_COURSE_AUTHORING_SOURCE_SIZE + 1 });
    expect(getCourseAuthoringSourceError(oversized)).toBe("courseAuthoring.sources.tooLarge");
  });

  it("binds a selected stable block to its lesson with the block baseline", () => {
    const course: CourseContext = {
      courseId: "course-1",
      language: "en",
      title: "Safety",
      description: "",
      baselineHash: "course-hash",
      fieldHashes: {},
      chapters: [
        {
          id: "chapter-1",
          title: "Chapter",
          displayOrder: 0,
          baselineHash: "chapter-hash",
          lessons: [
            {
              id: "lesson-1",
              title: "Lesson",
              lessonType: "content",
              displayOrder: 0,
              baselineHash: "lesson-hash",
              blocks: [{ id: "block-1", html: "<p>Only this</p>", baselineHash: "block-hash" }],
            },
          ],
        },
      ],
    };

    expect(buildAuthoringTargets(course, [], ["block-1"])).toEqual([
      {
        targetId: "lesson-1",
        kind: "block",
        language: "en",
        baselineHash: "block-hash",
        blockIds: ["block-1"],
        allowedFields: [],
      },
    ]);
  });
});
