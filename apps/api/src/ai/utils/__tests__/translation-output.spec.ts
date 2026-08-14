import {
  alignTranslationItems,
  formatTranslationItem,
  getTranslationContext,
  validateTranslationStructure,
} from "src/ai/utils/translation-output";

describe("translation output", () => {
  it("restores input order from item IDs", () => {
    const translations = [
      formatTranslationItem("translation-item-2", "Second"),
      formatTranslationItem("translation-item-1", "First"),
    ];

    expect(
      alignTranslationItems(translations, ["translation-item-1", "translation-item-2"]),
    ).toEqual(["First", "Second"]);
  });

  it("rejects a missing item even when another chunk could balance the aggregate count", () => {
    const translations = [
      formatTranslationItem("translation-item-1", "First"),
      formatTranslationItem("translation-item-2", "Second"),
      formatTranslationItem("translation-item-3", "Third"),
    ];

    expect(() =>
      alignTranslationItems(translations, [
        "translation-item-1",
        "translation-item-2",
        "translation-item-3",
        "translation-item-4",
      ]),
    ).toThrow("Translation output item count mismatch");
  });

  it("rejects duplicate and unknown item IDs", () => {
    expect(() =>
      alignTranslationItems(
        [
          formatTranslationItem("translation-item-1", "First"),
          formatTranslationItem("translation-item-1", "Duplicate"),
        ],
        ["translation-item-1", "translation-item-2"],
      ),
    ).toThrow("duplicate item ID");

    expect(() =>
      alignTranslationItems(
        [formatTranslationItem("translation-item-3", "Unknown")],
        ["translation-item-1"],
      ),
    ).toThrow("unknown item ID");
  });

  it("removes the active title and its description from title context", () => {
    expect(
      getTranslationContext("title", 'Webinar "Co to jest AML?"', {
        courseTitle: "Przewodnik po AML",
        chapterTitle: "Materiały video",
        lessonTitle: 'Webinar "Co to jest AML?"',
        lessonDescription: "<p>Odcinek wprowadzający</p>",
      }),
    ).toEqual({
      courseTitle: "Przewodnik po AML",
      chapterTitle: "Materiały video",
    });
  });

  it("keeps the title but removes the duplicated source from description context", () => {
    expect(
      getTranslationContext("description", "<p>Odcinek wprowadzający</p>", {
        lessonTitle: 'Webinar "Co to jest AML?"',
        lessonDescription: "<p>Odcinek wprowadzający</p>",
      }),
    ).toEqual({ lessonTitle: 'Webinar "Co to jest AML?"' });
  });

  it("rejects HTML contamination in titles and changed HTML structure in rich text", () => {
    expect(() =>
      validateTranslationStructure(
        'Webinar "Co to jest AML?"',
        "Webinář „Co to je AML?“ — <p>Úvodní díl</p>",
      ),
    ).toThrow("unexpectedly contains HTML");

    expect(() =>
      validateTranslationStructure(
        '<p>Odcinek</p><div data-provider="self"></div>',
        '<p>Díl</p><div data-provider="self"></div',
      ),
    ).toThrow("preserve the source HTML structure");
  });
});
