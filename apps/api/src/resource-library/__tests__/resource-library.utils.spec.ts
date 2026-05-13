import {
  extractResourceIdsFromRichText,
  getLocalizedRichTextEntries,
  removeResourceReferencesFromRichText,
} from "../resource-library.utils";

const resourceId = "11111111-1111-4111-8111-111111111111";
const otherResourceId = "22222222-2222-4222-8222-222222222222";

describe("resource-library utils", () => {
  describe("extractResourceIdsFromRichText", () => {
    it("extracts resource ids from rich text links and asset node attributes", () => {
      const html = [
        `<a href="/api/lesson/lesson-resource/${resourceId}" data-resource-id="${resourceId}">Download</a>`,
        `<div data-node-type="presentation" data-src="/api/articles/articles-resource/${otherResourceId}"></div>`,
      ].join("");

      expect(extractResourceIdsFromRichText(html)).toEqual([resourceId, otherResourceId]);
    });

    it("deduplicates resource ids", () => {
      const html = [
        `<a href="/api/lesson/lesson-resource/${resourceId}">Download</a>`,
        `<div data-src="/api/news/news-resource/${resourceId}"></div>`,
      ].join("");

      expect(extractResourceIdsFromRichText(html)).toEqual([resourceId]);
    });
  });

  describe("removeResourceReferencesFromRichText", () => {
    it("removes anchors matched by data-resource-id", () => {
      const html = `<p><a href="/api/lesson/lesson-resource/${resourceId}" data-resource-id="${resourceId}">Download</a><span>Keep</span></p>`;

      const result = removeResourceReferencesFromRichText(html, resourceId);

      expect(result.hasChanged).toBe(true);
      expect(result.content).not.toContain(resourceId);
      expect(result.content).toContain("<span>Keep</span>");
    });

    it("removes tiptap asset nodes matched by data-src URLs", () => {
      const html = [
        `<div data-node-type="presentation" data-src="/api/articles/articles-resource/${resourceId}"></div>`,
        `<div data-node-type="downloadable-file" data-src="/api/news/news-resource/${otherResourceId}"></div>`,
      ].join("");

      const result = removeResourceReferencesFromRichText(html, resourceId);

      expect(result.hasChanged).toBe(true);
      expect(result.content).not.toContain(resourceId);
      expect(result.content).toContain(otherResourceId);
    });

    it("does not remove partial UUID matches", () => {
      const html = `<a href="/api/lesson/lesson-resource/${resourceId.slice(0, -1)}2">Keep</a>`;

      expect(removeResourceReferencesFromRichText(html, resourceId)).toEqual({
        content: html,
        hasChanged: false,
      });
    });
  });

  describe("getLocalizedRichTextEntries", () => {
    it("returns only localized string entries from jsonb values", () => {
      expect(
        getLocalizedRichTextEntries({
          en: "English",
          lt: "Lithuanian",
          empty: null,
          nested: { value: "ignored" },
        }),
      ).toEqual([
        ["en", "English"],
        ["lt", "Lithuanian"],
      ]);
    });

    it("returns an empty array for non-object jsonb values", () => {
      expect(getLocalizedRichTextEntries(null)).toEqual([]);
      expect(getLocalizedRichTextEntries("plain")).toEqual([]);
      expect(getLocalizedRichTextEntries(["plain"])).toEqual([]);
    });
  });
});
