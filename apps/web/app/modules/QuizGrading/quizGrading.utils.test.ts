import {
  gradeAnswerFormSchema,
  parseQueueSearchParams,
  updateQueueSearchParams,
} from "./quizGrading.utils";

import type { TFunction } from "i18next";

const t = ((key: string) => key) as unknown as TFunction;

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
      "status=graded&courseId=c&lessonId=l&studentId=s&page=3&perPage=50",
    );

    expect(parseQueueSearchParams(params)).toEqual({
      status: "graded",
      courseId: "c",
      lessonId: "l",
      studentId: "s",
      page: 3,
      perPage: 50,
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
