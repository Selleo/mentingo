import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";

import type { UIMessage } from "@ai-sdk/react";
import type { RefObject } from "react";

type AiMentorPracticeMessagesProps = {
  messages: UIMessage[];
  isMessagesLoading: boolean;
  showChatLoader: boolean;
  aiMentorName: string;
  messagesContainerRef: RefObject<HTMLDivElement>;
};

export function AiMentorPracticeMessages({
  messages,
  isMessagesLoading,
  showChatLoader,
  aiMentorName,
  messagesContainerRef,
}: AiMentorPracticeMessagesProps) {
  return (
    <div
      ref={messagesContainerRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8 sm:py-7"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {!isMessagesLoading &&
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              id={message.id}
              role={message.role}
              parts={message.parts}
              aiName={aiMentorName}
              messageMaxWidthClass="max-w-[92%] sm:max-w-[78%]"
            />
          ))}
        {showChatLoader && <ChatLoader aiName={aiMentorName} />}
      </div>
    </div>
  );
}
