import { describe, expect, it } from "vitest";

import { getCourseStudentsAiMentorResultsRowId } from "./CourseStudentsAiMentorResults";
import { getCourseStudentsQuizResultsRowId } from "./CourseStudentsQuizResultsTable";

describe("course statistics row ids", () => {
  it("creates unique row ids for quiz results when one student has multiple lessons", () => {
    const rowIdA = getCourseStudentsQuizResultsRowId({
      studentId: "student-1",
      lessonId: "lesson-1",
    } as never);

    const rowIdB = getCourseStudentsQuizResultsRowId({
      studentId: "student-1",
      lessonId: "lesson-2",
    } as never);

    expect(rowIdA).not.toBe(rowIdB);
  });

  it("creates unique row ids for ai mentor results when one student has multiple lessons", () => {
    const rowIdA = getCourseStudentsAiMentorResultsRowId({
      studentId: "student-1",
      lessonId: "lesson-1",
    } as never);

    const rowIdB = getCourseStudentsAiMentorResultsRowId({
      studentId: "student-1",
      lessonId: "lesson-2",
    } as never);

    expect(rowIdA).not.toBe(rowIdB);
  });
});
