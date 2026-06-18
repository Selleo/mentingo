import { COURSE_GENERATION_STREAM_EVENT_TYPE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";

import {
  getCourseGenerationPreviewChapters,
  hasCourseGenerationPreviewEvents,
} from "../courseGenerationCourseCache.utils";

describe("course generation preview cache utilities", () => {
  it("maps camelCase Luma SDK preview events into temporary course chapters", () => {
    const streamData = [
      [
        {
          type: COURSE_GENERATION_STREAM_EVENT_TYPE.DESIGNER_CHAPTER_GENERATED,
          generation: {
            title: "Vectors, Matrices, and Core Operations",
            targetLessonCount: 3,
          },
        },
      ],
      [
        {
          type: COURSE_GENERATION_STREAM_EVENT_TYPE.ARCHITECT_LESSON_GENERATED,
          chapterIndex: 0,
          lessonIndex: 0,
          generation: {
            lessonType: "CONTENT",
            title: "Representing Data as Vectors",
          },
        },
      ],
    ];

    expect(hasCourseGenerationPreviewEvents(streamData)).toBe(true);

    expect(getCourseGenerationPreviewChapters(streamData)).toEqual([
      expect.objectContaining({
        id: "luma-preview-chapter-0-vectors-matrices-and-core-operations",
        title: "Vectors, Matrices, and Core Operations",
        displayOrder: 1,
        lessonCount: 1,
        lessons: [
          expect.objectContaining({
            id: "luma-preview-lesson-0-representing-data-as-vectors",
            title: "Representing Data as Vectors",
            type: LessonType.CONTENT,
            displayOrder: 1,
          }),
        ],
      }),
    ]);
  });

  it("uses explicit camelCase chapter indexes when Luma sends them", () => {
    const streamData = [
      {
        type: COURSE_GENERATION_STREAM_EVENT_TYPE.DESIGNER_CHAPTER_GENERATED,
        chapterIndex: 2,
        generation: {
          title: "Final Applications",
          targetLessonCount: 2,
        },
      },
    ];

    expect(getCourseGenerationPreviewChapters(streamData)).toEqual([
      expect.objectContaining({
        id: "luma-preview-chapter-2-final-applications",
        displayOrder: 3,
        lessonCount: 2,
      }),
    ]);
  });
});
