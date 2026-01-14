import { faker } from "@faker-js/faker";

const externalVideoUrls = [
  "https://vimeo.com/76979871",
  "https://vimeo.com/22439234",
  "https://vimeo.com/148751763",
  "https://vimeo.com/327303298",
];

const externalPresentationUrls = [
  "https://www.canva.com/design/DAG-Y-5QNHk/iEd44hOt-MWI9qpSLrykJg/edit",
  "https://www.canva.com/design/DAG-Y0UPxTc/ua45Yu9rdKzkoP3cRV7NGg/edit",
  "https://www.canva.com/design/DAG-Y1EXf7Q/IXsGSkUk1q1DVyZuYe6rYw/edit",
  "https://www.canva.com/design/DAG-Y1kiZag/nMecweknW5QH-pUonFOhGQ/edit",
];

const YOUTUBE_REGEX = /youtube\.com|youtu\.be/i;
const VIMEO_REGEX = /vimeo\.com/i;
const GOOGLE_SLIDES_REGEX = /docs\.google\.com\/.*presentation/i;
const CANVA_REGEX = /canva\.com\/.*design/i;

export function getRandomVideoUrl() {
  return faker.helpers.arrayElement(externalVideoUrls);
}

export function getRandomPresentationUrl() {
  return faker.helpers.arrayElement(externalPresentationUrls);
}

export function createResourceLinkHtml(url: string, label = "Open resource") {
  return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></p>`;
}

export function createResourceEmbedHtml(url: string) {
  if (YOUTUBE_REGEX.test(url))
    return `<div data-node-type="video" data-source-type="external" data-provider="youtube" data-src="${url}"></div>`;

  if (VIMEO_REGEX.test(url))
    return `<div data-node-type="video" data-source-type="external" data-provider="vimeo" data-src="${url}"></div>`;

  if (GOOGLE_SLIDES_REGEX.test(url))
    return `<div data-node-type="presentation" data-source-type="external" data-provider="google" data-src="${url}"></div>`;

  if (CANVA_REGEX.test(url))
    return `<div data-node-type="presentation" data-source-type="external" data-provider="canva" data-src="${url}"></div>`;

  return null;
}

export function appendResourceLinkToDescription(
  description: string | undefined,
  url: string,
  label = "Open resource",
) {
  const base = description?.trim() ?? "";
  const embedBlock = createResourceEmbedHtml(url) ?? createResourceLinkHtml(url, label);

  if (!base) return embedBlock;

  return `${base}<p></p>${embedBlock}`;
}
