import { getUiMessageText, MESSAGE_ROLE } from "@repo/shared";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { AI_CHAT_STATUSES } from "../aiMentorChat.constants";

import type { UIMessage } from "@ai-sdk/react";
import type { ChatStatus } from "ai";

type ChatReplyAnnouncerProps = {
  messages: UIMessage[];
  status: ChatStatus;
};

type Announcement = { id: string; text: string };

const isProcessingStatus = (status: ChatStatus) =>
  status === AI_CHAT_STATUSES.SUBMITTED || status === AI_CHAT_STATUSES.STREAMING;

// Announces a mentor reply once it has finished streaming, so screen readers don't read it token by token.
// Only a transition to "ready" counts: a stream that ends in "error" leaves partial text, not a finished reply.
export function ChatReplyAnnouncer({ messages, status }: ChatReplyAnnouncerProps) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const wasProcessingRef = useRef(isProcessingStatus(status));

  useEffect(() => {
    const hasReplyFinished = wasProcessingRef.current && status === AI_CHAT_STATUSES.READY;

    wasProcessingRef.current = isProcessingStatus(status);
    if (!hasReplyFinished) return;

    const lastMessage = messages.at(-1);

    if (lastMessage?.role !== MESSAGE_ROLE.MENTOR) return;

    setAnnouncement({ id: lastMessage.id, text: getUiMessageText(lastMessage) });
  }, [status, messages]);

  return (
    <div role="status" className="sr-only">
      {/* Rendered like the visible message so markdown syntax isn't read aloud; keying by id
          replaces the node, so a reply with the same text as the previous one is announced too. */}
      {announcement && (
        <div key={announcement.id}>
          <Markdown
            remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
            rehypePlugins={[rehypeKatex]}
          >
            {announcement.text}
          </Markdown>
        </div>
      )}
    </div>
  );
}
