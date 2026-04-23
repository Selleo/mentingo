import type { MailhogHeaderMap, MailhogMessage } from "./types";

export const decodeQuotedPrintable = (value: string) => {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
};

export const getMessageBodies = (message: MailhogMessage) => {
  const bodies = [
    message.Content?.Body,
    message.Raw?.Data,
    ...(message.MIME?.Parts?.map((part: { Body?: string }) => part.Body) ?? []),
  ].filter((body): body is string => typeof body === "string" && body.length > 0);

  return bodies.map((body) => decodeQuotedPrintable(body).replaceAll("&amp;", "&"));
};

export const matchesSubject = (headers: MailhogHeaderMap, subjectIncludes: string) => {
  const subjects = headers.Subject ?? [];
  return subjects.some((subject) => subject.toLowerCase().includes(subjectIncludes.toLowerCase()));
};
