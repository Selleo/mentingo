import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useJudgeLesson } from "~/api/mutations/useJudgeLesson";
import { useRetakeLesson } from "~/api/mutations/useRetakeLesson";
import { useCurrentThread } from "~/api/queries/useCurrentThread";
import { useCurrentThreadMessages } from "~/api/queries/useCurrentThreadMessages";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetLessonByIdResponse } from "~/api/generated-api";

interface AiMentorLessonProps {
  lesson: GetLessonByIdResponse["data"];
}

const AiMentorLesson = ({ lesson }: AiMentorLessonProps) => {
  const { t } = useTranslation();

  const { language } = useLanguageStore();

  const { mutateAsync: judgeLesson, isPending } = useJudgeLesson();
  const { mutateAsync: retakeLesson } = useRetakeLesson();

  const { data: currentThread } = useCurrentThread(lesson.id, language);
  const { data: currentThreadMessages } = useCurrentThreadMessages(currentThread?.data.id ?? "");

  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/ai/chat",
    initialMessages:
      currentThreadMessages?.data?.map((msg, index) => ({
        id: msg.id || `temp-${index}`,
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      })) || [],
    body: {
      threadId: currentThread?.data.id ?? "",
    },
    fetch: async (url, options) => {
      const body = JSON.parse(options?.body as string);
      return fetch(url, {
        ...options,
        body: JSON.stringify({
          content: body.messages[body.messages.length - 1]?.content || "",
          threadId: currentThread?.data.id ?? "",
        }),
      });
    },
  });

  const isThreadActive = currentThread?.data.status === "active";

  const handleJudge = async () => {
    await judgeLesson(
      { threadId: currentThread?.data.id ?? "" },
      {
        onSuccess: () => {
          queryClient
            .invalidateQueries({
              queryKey: ["threadMessages", { threadId: currentThread?.data.id }],
            })
            .then(() =>
              queryClient.invalidateQueries({ queryKey: ["thread", { lessonId: lesson.id }] }),
            );
        },
      },
    );
  };

  const handleRetakeLesson = async () => {
    await retakeLesson(
      {
        lessonId: lesson.id,
      },
      {
        onSuccess: () => {
          queryClient
            .invalidateQueries({
              queryKey: ["threadMessages", { threadId: currentThread?.data.id }],
            })
            .then(() =>
              queryClient.invalidateQueries({ queryKey: ["thread", { lessonId: lesson.id }] }),
            );
        },
      },
    );
  };

  const isLoading = status === "submitted";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="mx-auto flex size-full max-h-[70vh] min-h-[70vh] w-full flex-col items-center py-4">
      <div className="flex w-full grow flex-col gap-y-4 overflow-y-auto">
        {messages.map((messages, idx) => (
          <ChatMessage key={idx} {...messages} />
        ))}

        {isLoading || (isPending && <ChatLoader />)}
        <div ref={messagesEndRef} />
      </div>

      {isThreadActive && !isPending && (
        <div className="mt-8 w-full">
          <form onSubmit={handleSubmit}>
            <div
              className="flex w-full flex-col gap-y-4 rounded-2xl border px-6 py-4"
              style={{ backgroundColor: "#F5F6F7", borderColor: "#E4E6EB" }}
            >
              <div className="flex w-full items-end">
                <div className="flex grow flex-col">
                  <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder={t("studentCourseView.lesson.aiMentorLesson.sendMessage")}
                    className="w-full border-none bg-transparent py-2 text-base font-normal text-gray-500 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50"
                    style={{ boxShadow: "none" }}
                  />
                  <div className="mt-5 flex items-center gap-x-2">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full border-none bg-white shadow-sm disabled:opacity-50"
                    >
                      <Icon name="Plus" className="size-5 text-gray-700" />
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full border-none bg-white shadow-sm disabled:opacity-50"
                    >
                      <Icon name="Smile" className="size-5 text-gray-700" />
                    </button>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!input.trim()}
                    className="flex items-center gap-x-2 rounded-full px-5 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    <Icon name="Send" className="size-5" />
                    {t("studentCourseView.lesson.aiMentorLesson.send")}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      <hr className="mt-4 w-full border-t border-[#EDEDED]" />
      <div className="mt-4 flex w-full justify-center">
        {isThreadActive && !isPending ? (
          <Button
            variant="primary"
            size="lg"
            className="gap-2"
            style={{ maxWidth: 220 }}
            onClick={handleJudge}
          >
            {t("studentCourseView.lesson.aiMentorLesson.check")}
            <Icon name="ArrowRight" className="size-5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            style={{ maxWidth: 220 }}
            onClick={handleRetakeLesson}
          >
            Retake
            <Icon name="ArrowRight" className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default AiMentorLesson;
