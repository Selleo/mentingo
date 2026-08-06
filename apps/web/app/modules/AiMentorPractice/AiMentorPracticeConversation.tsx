import { useChat, type UIMessage } from "@ai-sdk/react";
import { createTextUiMessage, toUiMessageRole } from "@repo/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentThreadMessages } from "~/api/queries/useCurrentThreadMessages";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { AI_CHAT_STATUSES } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChat.constants";
import { createAiMentorChatTransport } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChatTransport";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";

type AiMentorPracticeConversationProps = {
  threadId: string;
  title: string | null;
};

export function AiMentorPracticeConversation({
  threadId,
  title,
}: AiMentorPracticeConversationProps) {
  const { t } = useTranslation();
  const { data: persistedMessages, isLoading } = useCurrentThreadMessages({
    isThreadLoading: !threadId,
    threadId,
  });
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => createAiMentorChatTransport(threadId), [threadId]);
  const { messages, setMessages, sendMessage, status } = useChat({ transport });
  const isProcessing =
    status === AI_CHAT_STATUSES.SUBMITTED || status === AI_CHAT_STATUSES.STREAMING;

  useEffect(() => {
    setMessages(
      persistedMessages?.data.map((message) =>
        createTextUiMessage<UIMessage>({
          id: message.id,
          role: toUiMessageRole<UIMessage["role"]>(message.role),
          content: message.content,
        }),
      ) ?? [],
    );
  }, [persistedMessages, setMessages]);

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const submit = () => {
    const message = input.trim();
    if (!message) return;
    setInput("");
    void sendMessage({ text: message });
  };

  return (
    <PageWrapper className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col">
      <h1 className="h4 mb-5">{title || t("aiMentorPractice.conversationTitle")}</h1>
      <div ref={containerRef} className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {!isLoading &&
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              id={message.id}
              role={message.role}
              parts={message.parts}
              aiName={t("studentCourseView.lesson.aiMentorLesson.aiMentorName")}
            />
          ))}
        {isProcessing && <ChatLoader aiName={t("aiMentorPractice.mentorName")} />}
      </div>
      <div className="mt-4 flex gap-3">
        <Textarea
          value={input}
          aria-label={t("aiMentorPractice.message")}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button disabled={!input.trim() || isProcessing} onClick={submit}>
          {t("aiMentorPractice.send")}
        </Button>
      </div>
    </PageWrapper>
  );
}
