import { load as loadHtml } from "cheerio";

import {
  AUTHORING_BLOCK_ID_ATTRIBUTE,
  COURSE_AUTHORING_BLOCK_ERROR,
  CourseAuthoringBlockError,
  getCourseAuthoringContentFingerprint,
  getCourseAuthoringBlocks,
  normalizeCourseAuthoringContent,
  normalizeCourseAuthoringHtml,
  normalizeCourseAuthoringBlocks,
  replaceCourseAuthoringBlock,
} from "../courseAuthoringBlocks";

const BLOCK_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

const idFactory = () => {
  let index = 0;
  return () => BLOCK_IDS[index++];
};

const expectBlockError = (callback: () => unknown, code: string) => {
  try {
    callback();
    throw new Error("Expected a CourseAuthoringBlockError");
  } catch (error) {
    expect(error).toBeInstanceOf(CourseAuthoringBlockError);
    expect((error as CourseAuthoringBlockError).code).toBe(code);
  }
};

describe("course authoring blocks", () => {
  it("preserves validated semantic lesson HTML and image captions", () => {
    const normalized = normalizeCourseAuthoringHtml(
      '<h2>Architecture</h2><figure><div data-node-type="image" data-src="/image.png"></div><figcaption>Data flow</figcaption></figure><p>Explanation</p>',
      idFactory(),
    );
    const $ = loadHtml(normalized);

    expect(
      $("body")
        .children()
        .toArray()
        .map((node) => $(node).prop("tagName")),
    ).toEqual(["H2", "FIGURE", "P"]);
    expect($("figcaption").text()).toBe("Data flow");
    expect($("figure [data-node-type='image']")).toHaveLength(1);
    expect(normalized).not.toContain("&lt;h2&gt;");
    expect(normalizeCourseAuthoringHtml(normalized, idFactory())).toBe(normalized);
  });

  it.each(["Use x < y & z", "&lt;h2&gt;Literal example&lt;/h2&gt;"])(
    "keeps validated plain or encoded copy as text: %s",
    (content) => {
      const normalized = normalizeCourseAuthoringHtml(content, idFactory());
      const $ = loadHtml(normalized);

      expect($("body").children()).toHaveLength(1);
      expect($("body").children().first().prop("tagName")).toBe("P");
      expect($("h2")).toHaveLength(0);
      expect($("body").text()).toBe(loadHtml(content)("body").text());
    },
  );

  it("wraps plain text in a stable top-level paragraph", () => {
    const normalized = normalizeCourseAuthoringContent("A clear lesson introduction", idFactory());
    const $ = loadHtml(normalized);

    expect($("body").children()).toHaveLength(1);
    expect($("body").children().first().prop("tagName")).toBe("P");
    expect($("body").children().first().text()).toBe("A clear lesson introduction");
    expect($("body").children().first().attr(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBe(BLOCK_IDS[0]);
  });

  it("preserves valid rich-text HTML while adding missing block identity", () => {
    const normalized = normalizeCourseAuthoringContent(
      '<p><strong>Keep rich formatting</strong></p><h2 id="next">Next</h2>',
      idFactory(),
    );

    expect(normalized).toContain("<strong>Keep rich formatting</strong>");
    expect(normalized).toContain('<h2 id="next"');
    expect(normalizeCourseAuthoringContent(normalized, idFactory())).toBe(normalized);
  });

  it("escapes markup-like plain text instead of treating it as executable HTML", () => {
    const normalized = normalizeCourseAuthoringContent(
      '<script>alert("unsafe")</script>',
      idFactory(),
    );
    const $ = loadHtml(normalized);

    expect($("script")).toHaveLength(0);
    expect($("body").text()).toBe('<script>alert("unsafe")</script>');
    expect(normalized).toContain("&lt;script&gt;");
  });

  it("rejects malformed supported HTML without weakening block identity checks", () => {
    expectBlockError(
      () => normalizeCourseAuthoringContent("<p><strong>Broken nesting</p>", idFactory()),
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
    );
  });

  it("assigns stable top-level IDs without replacing headings, anchors, or resource IDs", () => {
    const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const content = [
      '<h2 id="intro">Introduction</h2>',
      `<div data-node-type="image" data-src="/image.png" data-resource-id="${resourceId}"></div>`,
      "<ul><li><p>Nested list item</p></li></ul>",
    ].join("");

    const normalized = normalizeCourseAuthoringBlocks(content, idFactory());
    const $ = loadHtml(normalized);
    const blocks = $("body").children();

    expect(blocks.toArray().map((block) => $(block).attr(AUTHORING_BLOCK_ID_ATTRIBUTE))).toEqual(
      BLOCK_IDS,
    );
    expect($("h2").attr("id")).toBe("intro");
    expect($("div[data-node-type='image']").attr("data-resource-id")).toBe(resourceId);
    expect($("li").attr(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBeUndefined();
    expect($("li p").attr(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBeUndefined();

    expect(normalizeCourseAuthoringBlocks(normalized, idFactory())).toBe(normalized);
  });

  it("replaces one target while retaining its identity and all outside blocks", () => {
    const content = [
      `<h2 id="intro" ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[0]}">Before</h2>`,
      `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[1]}"><strong>Keep me</strong></p>`,
      `<div data-node-type="image" data-resource-id="resource-1" ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[2]}"></div>`,
    ].join("");

    const replaced = replaceCourseAuthoringBlock({
      content,
      targetBlockId: BLOCK_IDS[0],
      replacementHtml: '<h3 id="updated-anchor"><em>After</em></h3>',
    });
    const $ = loadHtml(replaced);
    const blocks = $("body").children();

    expect(blocks.eq(0).prop("tagName")).toBe("H3");
    expect(blocks.eq(0).attr(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBe(BLOCK_IDS[0]);
    expect(blocks.eq(0).attr("id")).toBe("updated-anchor");
    expect(blocks.eq(0).html()).toBe("<em>After</em>");
    expect(blocks.eq(1).toString()).toContain("<strong>Keep me</strong>");
    expect(blocks.eq(1).attr(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBe(BLOCK_IDS[1]);
    expect(blocks.eq(2).attr("data-resource-id")).toBe("resource-1");
    expect(blocks.eq(2).attr(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBe(BLOCK_IDS[2]);
  });

  it("rejects malformed and duplicate IDs before replacing content", () => {
    expectBlockError(
      () => normalizeCourseAuthoringBlocks('<p data-authoring-block-id="not-a-uuid">Text</p>'),
      COURSE_AUTHORING_BLOCK_ERROR.MALFORMED_ID,
    );

    expectBlockError(
      () =>
        normalizeCourseAuthoringBlocks(
          `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[0]}">One</p>` +
            `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[0]}">Two</p>`,
        ),
      COURSE_AUTHORING_BLOCK_ERROR.DUPLICATE_ID,
    );

    expectBlockError(
      () => normalizeCourseAuthoringBlocks("legacy root text"),
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
    );

    expectBlockError(
      () =>
        normalizeCourseAuthoringBlocks(
          `<ul ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[0]}">` +
            `<li ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[1]}">Nested</li></ul>`,
        ),
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
    );
  });

  it("requires exactly one replacement and keeps the target ID", () => {
    const content = `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[0]}">One</p>`;

    expectBlockError(
      () =>
        replaceCourseAuthoringBlock({
          content,
          targetBlockId: BLOCK_IDS[0],
          replacementHtml: "<p>First</p><p>Second</p>",
        }),
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_REPLACEMENT,
    );

    expectBlockError(
      () =>
        replaceCourseAuthoringBlock({
          content,
          targetBlockId: BLOCK_IDS[0],
          replacementHtml: `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[1]}">Changed</p>`,
        }),
      COURSE_AUTHORING_BLOCK_ERROR.REPLACEMENT_ID_MISMATCH,
    );
  });

  it("fingerprints content canonically while ignoring only derived playback attributes", () => {
    const base = [
      `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[0]}">Intro</p>`,
      `<div data-node-type="video" data-src="video.mp4" ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[1]}"></div>`,
    ].join("");
    const annotated = [
      `<p data-block-index="0" ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[0]}">Intro</p>`,
      `<div data-autoplay="autoplay" data-block-index="1" data-node-type="video" data-src="video.mp4" ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${BLOCK_IDS[1]}"></div>`,
    ].join("");
    const changed = base.replace("Intro", "Changed");

    expect(getCourseAuthoringContentFingerprint(annotated)).toBe(
      getCourseAuthoringContentFingerprint(base),
    );
    expect(getCourseAuthoringContentFingerprint(changed)).not.toBe(
      getCourseAuthoringContentFingerprint(base),
    );
  });
  it("keeps a selected block baseline stable when a different block is manually edited", () => {
    const original = normalizeCourseAuthoringBlocks("<p>First</p><p>Second</p>", idFactory());
    const changed = original.replace("Second", "Manual change");
    const before = getCourseAuthoringBlocks(original);
    const after = getCourseAuthoringBlocks(changed);
    expect(after[0].baselineHash).toBe(before[0].baselineHash);
    expect(after[1].baselineHash).not.toBe(before[1].baselineHash);
    const applied = replaceCourseAuthoringBlock({
      content: changed,
      targetBlockId: before[0].id,
      replacementHtml: "<p>AI first</p>",
    });
    expect(applied).toContain("AI first");
    expect(applied).toContain("Manual change");
  });
});
