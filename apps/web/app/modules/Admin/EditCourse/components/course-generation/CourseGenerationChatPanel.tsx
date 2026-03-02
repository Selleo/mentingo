import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { CourseGenerationComposer } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationComposer";
import { CourseGenerationAiTypingMessage } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationMessages";
import {
  getCurrentMessageKey,
  getMessageText,
} from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationChat.utils";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";

type CourseGenerationMessage = {
  id: string;
  role: string;
  content: unknown;
};

type CourseGenerationChatPanelProps = {
  courseId: string;
  messages: CourseGenerationMessage[];
  streamData: unknown;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  setInput: Dispatch<SetStateAction<string>>;
  isProcessing: boolean;
  onMessageCountChange: (count: number) => void;
  onClose: () => void;
  onGenerationStarted?: () => void;
};

export function CourseGenerationChatPanel({
  courseId,
  messages,
  streamData,
  input,
  onInputChange,
  onSubmit,
  isProcessing,
  onMessageCountChange,
  onClose,
  setInput,
  onGenerationStarted,
}: CourseGenerationChatPanelProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const generationStartedRef = useRef(false);

  useEffect(() => {
    onMessageCountChange(messages.length);
  }, [messages.length, onMessageCountChange]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (generationStartedRef.current) return;
    if (getCurrentMessageKey(streamData) !== "DESIGNING_CHAPTERS") return;
    generationStartedRef.current = true;
    onGenerationStarted?.();
  }, [streamData, onGenerationStarted]);

  const currentMessageKey = getCurrentMessageKey(streamData);

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
            role={message.role as "user" | "assistant"}
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
  const showTypingLoader = isProcessing && !hasStreamingAssistantText;
  const showThinkingLabel =
    Boolean(currentMessageKey) && isProcessing && !hasStreamingAssistantText;
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
            setInput={setInput}
            input={input}
            integrationId={courseId}
            onInputChange={onInputChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}
