import { getMessageBodies } from "./message";

import type { MailhogMessage } from "./types";

export const extractLinkFromMailhogMessage = (message: MailhogMessage, pathIncludes: string) => {
  const bodies = getMessageBodies(message);

  const candidateStrings = [
    ...bodies.flatMap((body) =>
      Array.from(body.matchAll(/href=["']([^"']+)["']/g), (match) => match[1]),
    ),
    ...bodies.flatMap((body) => body.match(/https?:\/\/[^\s"'<>]+/g) ?? []),
    ...bodies.flatMap((body) => body.match(/\/auth\/[^\s"'<>]+/g) ?? []),
  ]
    .filter(Boolean)
    .map((value) => String(value).replaceAll("&amp;", "&").trim())
    .map((value) => value.replace(/[)\].,;]+$/, ""));

  const link = candidateStrings.find((value) => value.includes(pathIncludes));

  if (!link) {
    throw new Error(`Could not find a link containing "${pathIncludes}" in Mailhog message`);
  }

  return link;
};
