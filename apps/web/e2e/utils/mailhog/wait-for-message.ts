import { createMailhogClient } from "./client";
import { matchesSubject } from "./message";

import type { MailhogHeaderMap, MailhogSearchResponse } from "./types";

const mailhogApi = createMailhogClient();

export const waitForMailhogMessage = async (options: {
  recipient: string;
  subjectIncludes: string;
  timeoutMs?: number;
}) => {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const startedAt = Date.now();

  let lastError: Error | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const { data } = await mailhogApi.api.v2SearchList({
        kind: "to",
        query: options.recipient,
        limit: 100,
      });

      const mails = data as MailhogSearchResponse;
      const messages = mails.items ?? [];

      const message = messages.find((item) => {
        const headers = (item.Content?.Headers ?? item.headers ?? {}) as MailhogHeaderMap;

        return matchesSubject(headers, options.subjectIncludes);
      });

      if (message) return message;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for Mailhog message to ${options.recipient} with subject containing "${options.subjectIncludes}"${
      lastError ? `: ${lastError.message}` : ""
    }`,
  );
};
