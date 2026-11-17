import {
  AI_CONVERSATION,
  AI_CONVERSATION_EVALUATION,
  AI_CONVERSATION_MESSAGES,
  AI_CONVERSATION_THREAD_ID,
} from "../../data/ai-conversations/ai-conversations.data";

import type { Page } from "@playwright/test";

type MockAiConversationsOptions = {
  /** Overrides the thread detail response; `null` makes the transcript unavailable (404). */
  thread?: (Partial<typeof AI_CONVERSATION> & { evaluation?: unknown }) | null;
  /** Replaces the default two-page transcript with a single page of these messages. */
  messages?: unknown[];
  /** Requests to this host are aborted and recorded. */
  blockedHost?: string;
};

export const mockAiConversationsFlow = async (
  page: Page,
  { blockedHost, messages, thread = {} }: MockAiConversationsOptions = {},
) => {
  const mutations: string[] = [];
  const blockedRequests: string[] = [];

  page.on("request", (request) => {
    if (/\/api\/(?:admin\/ai-threads|ai\/)/.test(request.url()) && request.method() !== "GET")
      mutations.push(request.url());
  });

  await page.route(/\/api\/admin\/ai-threads(?:\/|\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") || 1);

    if (url.pathname.endsWith("/messages")) {
      if (messages) {
        return route.fulfill({
          json: {
            data: messages,
            pagination: { page: 1, perPage: 100, totalItems: messages.length },
          },
        });
      }

      const isFirstPage = pageNumber === 1;
      return route.fulfill({
        json: {
          data: [
            {
              id: `message-${pageNumber}`,
              role: isFirstPage ? "user" : "assistant",
              content: isFirstPage
                ? AI_CONVERSATION_MESSAGES.learnerAnswer
                : AI_CONVERSATION_MESSAGES.mentorFeedback,
              createdAt: AI_CONVERSATION.lastActivityAt,
            },
          ],
          pagination: { page: pageNumber, perPage: 100, totalItems: 101 },
        },
      });
    }

    if (url.pathname.endsWith(AI_CONVERSATION_THREAD_ID)) {
      if (thread === null) return route.fulfill({ status: 404, json: { message: "Not found" } });

      return route.fulfill({
        json: { data: { ...AI_CONVERSATION, evaluation: AI_CONVERSATION_EVALUATION, ...thread } },
      });
    }

    return route.fulfill({
      json: {
        data: [AI_CONVERSATION],
        pagination: { page: pageNumber, perPage: 20, totalItems: 21 },
      },
    });
  });

  if (blockedHost) {
    await page.route(`**://${blockedHost}/**`, (route) => {
      blockedRequests.push(route.request().url());
      return route.abort();
    });
  }

  return { blockedRequests, mutations };
};
