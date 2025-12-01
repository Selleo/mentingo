import { pascalCase } from "../toPascalCase";

describe("pascalCase", () => {
  it("should capitalize each word in a string", () => {
    expect(pascalCase("hello world")).toBe("Hello World");
  });

  it("should handle single word", () => {
    expect(pascalCase("typescript")).toBe("Typescript");
  });

  it("should handle empty string", () => {
    expect(pascalCase("")).toBe("");
  });

  it("should handle multiple spaces", () => {
    expect(pascalCase("hello   world")).toBe("Hello   World");
  });

  it("should handle already capitalized words", () => {
    expect(pascalCase("Hello World")).toBe("Hello World");
  });

  it("should handle mixed case", () => {
    expect(pascalCase("hElLo wOrLd")).toBe("Hello World");
  });
});
