import { type Message, useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { COURSE_GENERATION_DRAFT_QUERY_KEY } from "~/api/queries/admin/useCourseGenerationDraft";
import {
  getCourseGenerationMessagesQueryKey,
  useCourseGenerationMessages,
} from "~/api/queries/admin/useCourseGenerationMessages";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import {
  getCurrentMessageKey,
  getMessageText,
  hasCourseGeneratedFlag,
} from "~/modules/Admin/EditCourse/compontents/courseGenerationChat.utils";
import { CourseGenerationComposer } from "~/modules/Admin/EditCourse/compontents/CourseGenerationComposer";
import { CourseGenerationAiTypingMessage } from "~/modules/Admin/EditCourse/compontents/CourseGenerationMessages";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";

import type { GetCourseGenerationDraftResponse } from "~/api/generated-api";

type CourseGenerationChatPanelProps = {
  onMessageCountChange: (count: number) => void;
  onClose: () => void;
  draft?: GetCourseGenerationDraftResponse;
};

const apiUrl = import.meta.env.VITE_API_URL;
const chatUrl = apiUrl
  ? `${apiUrl}/api/luma/course-generation/chat`
  : "/api/luma/course-generation/chat";

export function CourseGenerationChatPanel({
  onMessageCountChange,
  onClose,
  draft,
}: CourseGenerationChatPanelProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draftInvalidatedRef = useRef(false);
  const courseId = draft?.integrationId ?? "";

  const { data: courseGenerationMessages } = useCourseGenerationMessages(
    courseId,
    !!courseId && !!draft?.draftId,
  );

  const { messages, data, input, setInput, handleSubmit, status, setMessages } = useChat({
    api: chatUrl,
    body: {
      integrationId: courseId,
    },
    fetch: async (url, options) => {
      const body = JSON.parse((options?.body as string) ?? "{}");

      return fetch(url, {
        ...options,
        body: JSON.stringify({
          integrationId: courseId,
          message: body.messages?.[body.messages.length - 1]?.content || "",
        }),
        credentials: "include",
      });
    },
    onFinish: async () => {
      if (!draft?.draftId) return;

      await queryClient.invalidateQueries({
        queryKey: getCourseGenerationMessagesQueryKey(courseId),
      });
    },
  });

  useEffect(() => {
    setMessages(
      (courseGenerationMessages ?? []).map(
        (message): Message => ({
          id: message.id,
          role: message.role as Message["role"],
          content: message.content,
        }),
      ),
    );
  }, [courseGenerationMessages, setMessages]);

  useEffect(() => {
    onMessageCountChange(messages.length);
  }, [messages.length, onMessageCountChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (status === "submitted") {
      draftInvalidatedRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (draftInvalidatedRef.current) return;
    if (!hasCourseGeneratedFlag(data)) return;
    draftInvalidatedRef.current = true;

    void queryClient.invalidateQueries({
      queryKey: [COURSE_GENERATION_DRAFT_QUERY_KEY],
    });
  }, [data]);

  const handleSend = () => handleSubmit();

  const renderedMessages = useMemo(
    () =>
      messages
        .map((message) => ({
          id: message.id,
          role: message.role,
          text: getMessageText(message.content).trim(),
        }))
        .filter((message) => message.text.length > 0)
        .map((message) => (
          <ChatMessage
            key={message.id}
            id={message.id}
            role={message.role as Message["role"]}
            content={message.text}
            aiName={t("adminCourseView.common.aiCourseCreation")}
            messageMaxWidthClass="max-w-[80%]"
          />
        )),
    [messages, t],
  );

  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistantText =
    lastMessage?.role === "assistant" && getMessageText(lastMessage.content).trim().length > 0;
  const showTypingLoader =
    status === "submitted" || (status === "streaming" && !hasStreamingAssistantText);
  const currentMessageKey = getCurrentMessageKey(data);
  const showThinkingLabel =
    Boolean(currentMessageKey) &&
    (status === "submitted" || status === "streaming") &&
    !hasStreamingAssistantText;
  const thinkingLabel = t(`adminCourseView.thinking.${currentMessageKey ?? "THINKING"}`);
  const aiCourseCreationLabel = t("adminCourseView.common.aiCourseCreation");

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-14 items-center justify-between border-b border-neutral-200 px-6">
        <div className="flex items-center gap-2 text-neutral-900">
          <Icon name="AiMentor" className="size-4 text-primary-600" />
          <span className="text-base font-semibold tracking-tight text-black">
            {aiCourseCreationLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="inline-flex items-center justify-center rounded-full p-2.5 text-black transition hover:bg-neutral-200"
            >
              <Icon name="X" className="size-3" />
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto w-full max-w-[80%] space-y-5">
          {renderedMessages}
          {showTypingLoader && (
            <CourseGenerationAiTypingMessage
              aiLabel={aiCourseCreationLabel}
              thinkingLabel={showThinkingLabel ? thinkingLabel : null}
            />
          )}
        </div>
      </div>

      <div className="border-t border-neutral-200 px-5 py-4">
        <div className="mx-auto w-full max-w-[80%]">
          <CourseGenerationComposer
            input={input}
            integrationId={courseId}
            onInputChange={setInput}
            onSubmit={handleSend}
          />
        </div>
      </div>
    </div>
  );
}
