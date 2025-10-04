import { Type } from "@sinclair/typebox";

import { configValidator } from "../configValidator";

describe("configValidator", () => {
  it("should return object if object is valid", () => {
    const schema = Type.Object({
      A: Type.String(),
      B: Type.Number(),
    });
    const values = { A: "test", B: 123 };

    const validate = configValidator(schema);
    expect(validate(values)).toBe(values);
  });

  it("should return object if object has more values than required", () => {
    const schema = Type.Object({
      A: Type.String(),
      B: Type.Number(),
    });
    const values = { A: "test", B: 123, C: true };

    const validate = configValidator(schema);
    expect(validate(values)).toBe(values);
  });

  it("should return object if object is nested", () => {
    const schema = Type.Object({
      A: Type.String(),
      B: Type.Object({ C: Type.Number() }),
    });
    const values = { A: "test", B: { C: 123 } };

    const validate = configValidator(schema);
    expect(validate(values)).toBe(values);
  });

  it("should throw error if one of the values has different type", () => {
    const schema = Type.Object({
      A: Type.String(),
      B: Type.Number(),
    });
    const values = { A: "test", B: "test" };

    const validate = configValidator(schema);
    expect(() => validate(values)).toThrow("Invalid configuration");
  });

  it("should throw error if one of the values is missing", () => {
    const schema = Type.Object({
      A: Type.String(),
      B: Type.Number(),
    });
    const values = { A: "test" };

    const validate = configValidator(schema);
    expect(() => validate(values)).toThrow("Invalid configuration");
  });

  it("should throw error if one of the values has different casing", () => {
    const schema = Type.Object({
      A: Type.String(),
      B: Type.Number(),
    });
    const values = { A: "test", b: 123 };

    const validate = configValidator(schema);
    expect(() => validate(values)).toThrow("Invalid configuration");
  });

  it("should throw error if values are empty", () => {
    const schema = Type.Object({
      A: Type.String(),
      B: Type.Number(),
    });
    const values = {};

    const validate = configValidator(schema);
    expect(() => validate(values)).toThrow("Invalid configuration");
  });
});
