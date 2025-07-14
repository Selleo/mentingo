import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

import type React from "react";

const AiMentorLesson: React.FC = () => {
  const { t } = useTranslation();
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "initial",
        role: "assistant",
        content:
          "This is an AI-powered mentoring session. The AI will guide you through the lesson based on the instructor's guidelines.",
      },
    ],
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: currentUser } = useCurrentUserSuspense();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderMessage = (message: {
    id: string;
    role: string;
    content: string;
    user?: { name?: string; email?: string };
    name?: string;
    email?: string;
  }) => {
    const isAI = message.role === "assistant";
    let userName = t("studentCourseView.lesson.aiMentorLesson.aiMentorName");
    if (!isAI) {
      userName =
        message.user?.name ||
        message.name ||
        `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim() ||
        t("studentCourseView.lesson.aiMentorLesson.userName");
    }
    return (
      <div key={message.id} className="flex items-start gap-x-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
          {isAI ? (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100">
              <Icon name="AiMentor" className="h-5 w-5 text-blue-600" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-200">
              <Icon name="User" className="h-5 w-5 text-gray-500" />
            </div>
          )}
        </div>
        <div className="flex max-w-[80%] flex-col">
          <span className="mb-1 text-sm font-semibold text-blue-900">{userName}</span>
          <p className="text-sm leading-relaxed text-gray-800">{message.content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-[70vh] max-h-[900px] min-h-[70vh] w-full max-w-4xl flex-col items-center px-4 py-8">
      <div className="flex w-full flex-grow flex-col gap-y-4 overflow-y-auto">
        {messages.map(renderMessage)}
        {isLoading && (
          <div className="flex items-start gap-x-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
              ★
            </div>
            <div className="flex max-w-[80%] flex-col">
              <span className="mb-1 text-sm font-semibold text-blue-900">
                {t("studentCourseView.lesson.aiMentorLesson.aiMentorName")}
              </span>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex animate-pulse space-x-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <span>{t("studentCourseView.lesson.aiMentorLesson.typing")}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="mt-8 w-full">
        <form onSubmit={handleSubmit}>
          <div
            className="flex w-full flex-col gap-y-4 rounded-2xl border px-6 py-4"
            style={{ backgroundColor: "#F5F6F7", borderColor: "#E4E6EB" }}
          >
            <div className="flex w-full items-end">
              <div className="flex flex-grow flex-col">
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder={t("studentCourseView.lesson.aiMentorLesson.sendAMessage")}
                  disabled={isLoading}
                  className="w-full border-none bg-transparent py-2 text-base font-normal text-gray-500 shadow-none focus:outline-none focus:ring-0 disabled:opacity-50"
                  style={{ boxShadow: "none" }}
                />
                <div className="mt-5 flex items-center gap-x-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-white shadow-sm disabled:opacity-50"
                  >
                    <Icon name="Plus" className="h-5 w-5 text-gray-700" />
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-none bg-white shadow-sm disabled:opacity-50"
                  >
                    <Icon name="Smile" className="h-5 w-5 text-gray-700" />
                  </button>
                </div>
              </div>
              <div className="ml-4 flex-shrink-0">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isLoading || !input.trim()}
                  className="flex items-center gap-x-2 rounded-full px-5 py-2 font-semibold text-white disabled:opacity-50"
                >
                  <Icon name="Send" className="h-5 w-5" />
                  {isLoading
                    ? t("common.other.uploadingImage")
                    : t("studentCourseView.lesson.aiMentorLesson.send")}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <hr className="my-8 w-full border-t border-[#EDEDED]" />
      <div className="mb-4 flex w-full justify-center">
        <Button
          variant="primary"
          size="lg"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#3F58B6] px-8 py-3 font-semibold text-white"
          style={{ maxWidth: 220 }}
        >
          {t("studentCourseView.lesson.aiMentorLesson.check")}
          <Icon name="ArrowRight" className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default AiMentorLesson;
