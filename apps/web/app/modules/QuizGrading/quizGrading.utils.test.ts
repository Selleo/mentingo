import {
  gradeAnswerFormSchema,
  parseQueueSearchParams,
  updateQueueSearchParams,
} from "./quizGrading.utils";

import type { TFunction } from "i18next";

const t = ((key: string) => key) as unknown as TFunction;

const COURSE_ID = "8f0c2a4e-1b7d-4c3a-9e5f-2d6b8a1c3e70";
const LESSON_ID = "3b9d7e21-5c4a-4f8b-a1e6-7c2d9f0b4a58";
const STUDENT_ID = "c6e1f8a3-2d5b-4e7c-9a0f-1b3d5e7f9a21";

describe("parseQueueSearchParams", () => {
  it("defaults to the first page of pending answers", () => {
    expect(parseQueueSearchParams(new URLSearchParams())).toEqual({
      status: "pending",
      courseId: undefined,
      lessonId: undefined,
      studentId: undefined,
      page: 1,
      perPage: 20,
    });
  });

  it("ignores invalid status, page and page size values", () => {
    const params = new URLSearchParams("status=unknown&page=-2&perPage=7");

    expect(parseQueueSearchParams(params)).toMatchObject({
      status: "pending",
      page: 1,
      perPage: 20,
    });
  });

  it("reads filters from the URL", () => {
    const params = new URLSearchParams(
      `status=graded&courseId=${COURSE_ID}&lessonId=${LESSON_ID}&studentId=${STUDENT_ID}&page=3&perPage=50`,
    );

    expect(parseQueueSearchParams(params)).toEqual({
      status: "graded",
      courseId: COURSE_ID,
      lessonId: LESSON_ID,
      studentId: STUDENT_ID,
      page: 3,
      perPage: 50,
    });
  });

  it("drops filter ids that are not UUIDs", () => {
    const params = new URLSearchParams(`courseId=abc&lessonId=${LESSON_ID}&studentId=`);

    expect(parseQueueSearchParams(params)).toMatchObject({
      courseId: undefined,
      lessonId: LESSON_ID,
      studentId: undefined,
    });
  });
});

describe("updateQueueSearchParams", () => {
  it("resets the page and the lesson when the course changes", () => {
    const params = new URLSearchParams("courseId=a&lessonId=l&page=4");

    expect(updateQueueSearchParams(params, { courseId: "b" }).toString()).toBe("courseId=b");
  });

  it("removes cleared filters and keeps an explicit page", () => {
    const params = new URLSearchParams("studentId=s&status=graded");

    expect(updateQueueSearchParams(params, { studentId: undefined }).toString()).toBe(
      "status=graded",
    );
    expect(updateQueueSearchParams(params, { page: "2" }).get("page")).toBe("2");
  });
});

describe("gradeAnswerFormSchema", () => {
  const schema = gradeAnswerFormSchema(t, 3);

  it.each(["0", "3", " 2 "])("accepts whole points within range: %s", (awardedPoints) => {
    expect(schema.safeParse({ awardedPoints, comment: "" }).success).toBe(true);
  });

  it.each(["", "4", "-1", "1.5", "abc"])("rejects invalid points: %s", (awardedPoints) => {
    expect(schema.safeParse({ awardedPoints, comment: "" }).success).toBe(false);
  });

  it("rejects comments over the limit", () => {
    expect(schema.safeParse({ awardedPoints: "1", comment: "a".repeat(5001) }).success).toBe(false);
  });
});
