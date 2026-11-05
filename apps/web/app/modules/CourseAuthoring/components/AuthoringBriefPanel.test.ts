import { MAX_COURSE_AUTHORING_SOURCE_SIZE } from "@repo/shared";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { buildAuthoringTargets, getCourseAuthoringSourceError } from "./AuthoringBriefPanel";
import { AuthoringSourcePopover } from "./AuthoringSourcePopover";
import { AuthoringToolsPopover } from "./AuthoringToolsPopover";

import type { CourseContext, SourcePolicy } from "../courseAuthoring.types";

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

  it.each([
    ["figure.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["diagram.webp", "image/webp"],
    ["FIGURE.PNG", ""],
    ["photo.JPEG", ""],
    ["diagram.webp", ""],
  ])("accepts supported source image %s (%s)", (name, type) => {
    expect(getCourseAuthoringSourceError(new File(["image"], name, { type }))).toBeNull();
  });

  it.each([
    ["animation.gif", "image/gif"],
    ["diagram.svg", "image/svg+xml"],
    ["animation.gif", ""],
    ["diagram.svg", ""],
  ])("rejects unsupported image %s (%s)", (name, type) => {
    expect(getCourseAuthoringSourceError(new File(["image"], name, { type }))).toBe(
      "courseAuthoring.sources.unsupportedFile",
    );
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

  it.each(["source", "tools"])(
    "offers the supported image extensions in the %s file picker",
    (picker) => {
      const policy: SourcePolicy = {
        sourceVersionIds: [],
        webEnabled: false,
        generalKnowledgeEnabled: false,
        researchDepth: "standard",
        requiredSectionIds: [],
        excludedSectionIds: [],
      };
      const common = {
        policy,
        sources: [],
        sourceRefreshes: [],
        open: true,
        onPolicyChange: vi.fn(),
        onUploadSource: vi.fn(),
      };
      const component =
        picker === "source"
          ? createElement(AuthoringSourcePopover, { ...common, sourceUploadError: null })
          : createElement(AuthoringToolsPopover, {
              ...common,
              strictSourceMode: false,
              selectedTargetIds: [],
              selectedBlockIds: [],
              course: {
                courseId: "course-1",
                language: "en",
                title: "Course",
                description: "",
                baselineHash: "baseline",
                fieldHashes: {},
                chapters: [],
              },
              onStrictSourceModeChange: vi.fn(),
              onSelectedTargetIdsChange: vi.fn(),
              onSelectedBlockIdsChange: vi.fn(),
            });
      renderWith().render(component);
      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(input).not.toBeNull();
      const accepted = input?.accept.split(",") ?? [];
      expect(accepted).toEqual(
        expect.arrayContaining([
          ".png",
          ".jpg",
          ".jpeg",
          ".webp",
          "image/png",
          "image/jpeg",
          "image/webp",
        ]),
      );
      expect(accepted).not.toContain(".gif");
      expect(accepted).not.toContain(".svg");
      expect(accepted).not.toContain("image/gif");
      expect(accepted).not.toContain("image/svg+xml");
    },
  );

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
