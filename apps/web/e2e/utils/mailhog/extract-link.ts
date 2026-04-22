import { decodeQuotedPrintable, getMessageBodies } from "./message";

import type { MailhogMessage } from "./types";

export const extractLinkFromMailhogMessage = (message: MailhogMessage, pathIncludes: string) => {
  const bodies = getMessageBodies(message);

  const candidateStrings = [
    ...bodies,
    ...bodies.flatMap((body) => body.match(/https?:\/\/[^\s"'<>]+/g) ?? []),
    ...bodies.flatMap((body) => body.match(/\/auth\/[^\s"'<>]+/g) ?? []),
  ]
    .filter(Boolean)
    .flatMap((value) =>
      decodeQuotedPrintable(String(value))
        .replaceAll("&amp;", "&")
        .split(/\r?\n/)
        .map((part) => part.trim())
        .filter(Boolean),
    );

  const link = candidateStrings.find((value) => value.includes(pathIncludes));

  if (!link) {
    throw new Error(`Could not find a link containing "${pathIncludes}" in Mailhog message`);
  }

  return link;
};
