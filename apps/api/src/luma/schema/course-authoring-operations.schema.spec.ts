import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { validate } from "uuid";

import { authoringOperationSchema } from "./course-authoring-operations.schema";

describe("authoring producer operation compatibility", () => {
  beforeAll(() => FormatRegistry.Set("uuid", validate));

  const fixture = (name: string): unknown =>
    JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          "../../../../../docs/contracts/course-authoring",
          `${name}-operation.json`,
        ),
        "utf8",
      ),
    );

  it.each(["content", "quiz", "mentor"])("accepts the typed %s producer fixture", (name) => {
    const operation = fixture(name);
    const errors = [...Value.Errors(authoringOperationSchema, operation)];
    expect(errors.map((error) => ({ path: error.path, message: error.message }))).toEqual([]);
  });

  it("does not accept arbitrary course settings or category updates", () => {
    const operation = fixture("content") as Record<string, unknown>;
    expect(
      Value.Check(authoringOperationSchema, {
        ...operation,
        type: "course.settings.update",
        payload: { categoryId: "00000000-0000-4000-8000-000000000001" },
      }),
    ).toBe(false);
  });

  it("rejects unknown lesson capabilities", () => {
    const operation = fixture("content") as Record<string, unknown>;
    expect(
      Value.Check(authoringOperationSchema, {
        ...operation,
        payload: { lessonType: "generated_video", title: "Video", description: "" },
      }),
    ).toBe(false);
  });
});
