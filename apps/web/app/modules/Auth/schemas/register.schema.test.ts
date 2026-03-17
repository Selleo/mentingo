import { describe, expect, it } from "vitest";

import { makeRegisterSchema } from "./register.schema";

import type i18next from "i18next";

const t = ((key: string) => key) as unknown as typeof i18next.t;

const validBaseData = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  password: "StrongPass123!",
  language: "en",
  birthday: "",
};

describe("makeRegisterSchema", () => {
  it("validates required checkboxes even when age limit is not configured", () => {
    const schema = makeRegisterSchema(t, undefined, ["consent-1"]);

    const result = schema.safeParse({
      ...validBaseData,
      formAnswers: {
        "consent-1": false,
      },
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["formAnswers", "consent-1"],
          message: "registerView.validation.requiredCheckbox",
        }),
      ]),
    );
  });
});
