import { faker } from "@faker-js/faker";

const externalVideoUrls = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
];

const externalPresentationUrls = [
  "https://res.cloudinary.com/dinpapxzv/raw/upload/v1727104719/presentation_gp0o3d.pptx",
];

export function getRandomVideoUrl() {
  return faker.helpers.arrayElement(externalVideoUrls);
}

export function getRandomPresentationUrl() {
  return faker.helpers.arrayElement(externalPresentationUrls);
}

export function createResourceLinkHtml(url: string, label = "Open resource") {
  return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></p>`;
}

export function appendResourceLinkToDescription(
  description: string | undefined,
  url: string,
  label = "Open resource",
) {
  const base = description?.trim() ?? "";
  const link = createResourceLinkHtml(url, label);

  if (!base) return link;

  return `${base}\n\n${link}`;
}
