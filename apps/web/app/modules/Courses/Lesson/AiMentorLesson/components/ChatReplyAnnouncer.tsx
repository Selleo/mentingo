import { getUiMessageText, MESSAGE_ROLE } from "@repo/shared";
import { useEffect, useRef, useState } from "react";

import type { UIMessage } from "@ai-sdk/react";

type ChatReplyAnnouncerProps = {
  messages: UIMessage[];
  isProcessing: boolean;
};

// Announces a mentor reply once it has finished streaming, so screen readers don't read it token by token.
export function ChatReplyAnnouncer({ messages, isProcessing }: ChatReplyAnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");
  const wasProcessingRef = useRef(isProcessing);

  useEffect(() => {
    const hasReplyFinished = wasProcessingRef.current && !isProcessing;

    wasProcessingRef.current = isProcessing;
    if (!hasReplyFinished) return;

    const lastMessage = messages.at(-1);

    if (lastMessage?.role !== MESSAGE_ROLE.MENTOR) return;

    setAnnouncement(getUiMessageText(lastMessage));
  }, [isProcessing, messages]);

  return (
    <div role="status" className="sr-only">
      {announcement}
    </div>
  );
}
