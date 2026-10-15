import { normalizeSearchTerm } from "./normalizeSearchTerm";

describe("prefix search query normalization", () => {
  it("keeps prefix matching while dropping empty punctuation tokens", () => {
    expect(normalizeSearchTerm("policy !!! expens")).toBe("policy:* & expens:*");
  });

  it("produces an empty tsquery rather than an invalid prefix for punctuation only", () => {
    expect(normalizeSearchTerm('!!! () ... " \\')).toBe("");
  });

  it("preserves multilingual words and treats punctuation as word boundaries", () => {
    expect(normalizeSearchTerm("Zażółć ISO-27001? 東京")).toBe(
      "Zażółć:* & ISO:* & 27001:* & 東京:*",
    );
  });
});
