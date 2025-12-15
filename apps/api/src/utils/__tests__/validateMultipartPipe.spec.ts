import { BadRequestException } from "@nestjs/common";
import { Type } from "@sinclair/typebox";

import { ValidateMultipartPipe } from "../pipes/validateMultipartPipe";

describe("ValidateMultipartPipe", () => {
  const UserSchema = Type.Object({
    name: Type.String(),
    age: Type.Number(),
    isActive: Type.Boolean(),
    meta: Type.Optional(
      Type.Object({
        tags: Type.Array(Type.String()),
      }),
    ),
  });

  let pipe: ValidateMultipartPipe<typeof UserSchema>;

  beforeEach(() => {
    pipe = new ValidateMultipartPipe(UserSchema);
  });

  it("should validate and parse valid multipart data", () => {
    const multipartData = {
      name: "John",
      age: "30",
      isActive: "true",
      meta: JSON.stringify({ tags: ["admin", "user"] }),
    };
    const result = pipe.transform(multipartData);
    expect(result).toEqual({
      name: "John",
      age: 30,
      isActive: true,
      meta: { tags: ["admin", "user"] },
    });
  });

  it("should throw BadRequestException for invalid data", () => {
    const multipartData = {
      name: "John",
      age: "not-a-number",
      isActive: "true",
    };
    expect(() => pipe.transform(multipartData)).toThrow(BadRequestException);
  });

  it("should handle arrays in multipart data", () => {
    const multipartData = {
      name: "Alice",
      age: "25",
      isActive: "false",
      meta: JSON.stringify({ tags: ["dev", "qa"] }),
    };
    const result = pipe.transform(multipartData);
    expect(result.meta).toEqual({ tags: ["dev", "qa"] });
  });

  it("should handle missing optional fields", () => {
    const multipartData = {
      name: "Bob",
      age: "40",
      isActive: "false",
    };
    const result = pipe.transform(multipartData);
    expect(result).toEqual({
      name: "Bob",
      age: 40,
      isActive: false,
    });
  });

  it("should throw BadRequestException for completely invalid input", () => {
    expect(() => pipe.transform(undefined as any)).toThrow(BadRequestException);
    expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
    expect(() => pipe.transform("string" as any)).toThrow(BadRequestException);
  });

  it("should handle empty multipart data", () => {
    const multipartData = {};
    expect(() => pipe.transform(multipartData)).toThrow(BadRequestException);
  });

  it("should handle nested objects in multipart data", () => {
    const multipartData = {
      name: "Charlie",
      age: "35",
      isActive: "true",
      meta: JSON.stringify({ tags: ["user"], details: { role: "admin" } }),
    };
    const result = pipe.transform(multipartData);
    expect(result.meta).toEqual({
      tags: ["user"],
      details: { role: "admin" },
    });
  });

  it("should parse numeric strings correctly", () => {
    const multipartData = {
      name: "Dave",
      age: "42",
      isActive: "true",
      meta: JSON.stringify({ tags: ["numeric"] }),
    };
    const result = pipe.transform(multipartData);
    expect(result.age).toBe(42);
  });

  it("should parse boolean strings correctly", () => {
    const multipartData = {
      name: "Eve",
      age: "28",
      isActive: "false",
      meta: JSON.stringify({ tags: ["boolean"] }),
    };
    const result = pipe.transform(multipartData);
    expect(result.isActive).toBe(false);
  });

  it("should ignore empty strings for optional fields", () => {
    const multipartData = {
      name: "John",
      age: "30",
      isActive: "true",
      meta: "",
    };
    const result = pipe.transform(multipartData);
    expect(result).toEqual({
      name: "John",
      age: 30,
      isActive: true,
    });
  });

  it("should fail when required fields are empty strings", () => {
    const multipartData = {
      name: "",
      age: "30",
      isActive: "true",
    };
    expect(() => pipe.transform(multipartData)).toThrow(BadRequestException);
  });
});
