import { isRichTextEmpty } from "src/utils/isRichTextEmpty";

describe("isRichTextEmpty", () => {
  it("returns true for empty string", () => {
    expect(isRichTextEmpty("")).toBe(true);
  });

  it("returns true for whitespace", () => {
    expect(isRichTextEmpty("     ")).toBe(true);
  });

  it("returns true for empty HTML tags", () => {
    expect(isRichTextEmpty("<p></p>")).toBe(true);
  });

  it("returns true for zero-width space", () => {
    expect(isRichTextEmpty("\u200B")).toBe(true);
  });

  it("returns false for non-empty text", () => {
    expect(isRichTextEmpty("Hello")).toBe(false);
    expect(isRichTextEmpty("<b>Hi</b>")).toBe(false);
  });
});
