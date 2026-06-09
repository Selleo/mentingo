import { describe, expect, it } from "vitest";

import {
  getImageEmbedAttrsFromElement,
  normalizeImageEmbedAttributes,
} from "~/components/RichText/extensions/utils/image";

const resourceId = "11111111-1111-4111-8111-111111111111";

const createElement = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
};

describe("image embed attributes", () => {
  it("normalizes src, alt and resource id", () => {
    expect(
      normalizeImageEmbedAttributes({
        src: ` /api/lesson/lesson-resource/${resourceId} `,
        alt: "Diagram",
      }),
    ).toEqual({
      src: `/api/lesson/lesson-resource/${resourceId}`,
      alt: "Diagram",
      resourceId,
    });
  });

  it("parses custom image nodes from html", () => {
    const element = createElement(
      `<div data-node-type="image" data-src="/api/lesson/lesson-resource/${resourceId}" data-alt="Schema" data-resource-id="${resourceId}"></div>`,
    );

    expect(getImageEmbedAttrsFromElement(element)).toEqual({
      src: `/api/lesson/lesson-resource/${resourceId}`,
      alt: "Schema",
      resourceId,
    });
  });

  it("rejects elements without image node metadata", () => {
    const rawImage = createElement('<img src="/image.png" alt="Image" />');

    expect(getImageEmbedAttrsFromElement(rawImage)).toBe(false);
    expect(getImageEmbedAttrsFromElement(createElement('<div data-node-type="image"></div>'))).toBe(
      false,
    );
  });
});
