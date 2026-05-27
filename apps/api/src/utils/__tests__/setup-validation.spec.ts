import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import { setupValidation } from "../setup-validation";

describe("setupValidation", () => {
  beforeAll(() => {
    setupValidation();
  });

  it("registers date-time validation for ISO timestamps", () => {
    const validator = TypeCompiler.Compile(Type.String({ format: "date-time" }));

    expect(validator.Check("2026-05-13T08:22:02.087Z")).toBe(true);
  });

  it("registers date validation for ISO dates", () => {
    const validator = TypeCompiler.Compile(Type.String({ format: "date" }));

    expect(validator.Check("2026-05-21")).toBe(true);
  });

  it("rejects invalid date strings", () => {
    const validator = TypeCompiler.Compile(Type.String({ format: "date" }));

    expect(validator.Check("2026-02-31")).toBe(false);
    expect(validator.Check("2026-5-21")).toBe(false);
    expect(validator.Check("not-a-date")).toBe(false);
  });

  it("accepts Postgres timestamp strings returned by the database driver", () => {
    const validator = TypeCompiler.Compile(Type.String({ format: "date-time" }));

    expect(validator.Check("2026-05-13 08:22:02.087+00")).toBe(true);
  });

  it("rejects invalid date-time strings", () => {
    const validator = TypeCompiler.Compile(Type.String({ format: "date-time" }));

    expect(validator.Check("not-a-date")).toBe(false);
  });
});
