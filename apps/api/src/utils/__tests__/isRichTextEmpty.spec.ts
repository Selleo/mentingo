import { isRichTextEmpty } from "src/utils/isRichTextEmpty";

describe("isRichTextEmpty", () => {
  it("should return true for empty string", () => {
    expect(isRichTextEmpty("")).toBe(true);
  });

  it("should return true for whitespace", () => {
    expect(isRichTextEmpty("     ")).toBe(true);
  });

  it("should return true for empty HTML tags", () => {
    expect(isRichTextEmpty("<p></p>")).toBe(true);
  });

  it("should return true for zero-width space", () => {
    expect(isRichTextEmpty("\u200B")).toBe(true);
  });

  it("should return false for non-empty text", () => {
    expect(isRichTextEmpty("Hello")).toBe(false);
    expect(isRichTextEmpty("<b>Hi</b>")).toBe(false);
  });
});
