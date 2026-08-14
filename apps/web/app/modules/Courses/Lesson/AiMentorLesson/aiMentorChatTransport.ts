import { DefaultChatTransport } from "ai";

import type { UIMessage } from "@ai-sdk/react";

const apiUrl = import.meta.env.VITE_API_URL;
const chatUrl = apiUrl ? `${apiUrl}/api/ai/chat` : "/api/ai/chat";

export function createAiMentorChatTransport(threadId: string) {
  return new DefaultChatTransport<UIMessage>({
    api: chatUrl,
    credentials: "include",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        threadId,
        message: messages[messages.length - 1],
      },
      credentials: "include",
    }),
  });
}
