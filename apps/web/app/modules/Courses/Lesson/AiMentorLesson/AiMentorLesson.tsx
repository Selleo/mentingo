import { type Message, useChat } from "@ai-sdk/react";
import { useParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useJudgeLesson } from "~/api/mutations/useJudgeLesson";
import { useRetakeLesson } from "~/api/mutations/useRetakeLesson";
import { useCurrentThread } from "~/api/queries/useCurrentThread";
import { useCurrentThreadMessages } from "~/api/queries/useCurrentThreadMessages";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import Loader from "~/modules/common/Loader/Loader";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { LessonForm } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonForm";
import RetakeModal from "~/modules/Courses/Lesson/AiMentorLesson/components/RetakeModal";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

const AiMentorLesson = () => {
  const { t } = useTranslation();
  const { lessonId = "", courseId = "" } = useParams();
  const { language } = useLanguageStore();

  const { mutateAsync: judgeLesson, isPending: isJudgePending } = useJudgeLesson(
    lessonId,
    courseId,
  );
  const { mutateAsync: retakeLesson } = useRetakeLesson(lessonId, courseId);

  const { data: currentThread, isFetching: isThreadLoading } = useCurrentThread(lessonId, language);

  const { data: currentThreadMessages } = useCurrentThreadMessages(
    lessonId,
    isThreadLoading,
    currentThread?.data.id,
  );

  const [showRetakeModal, setShowRetakeModal] = useState(false);

  const { messages, input, setMessages, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/ai/chat",
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

  useEffect(() => {
    setMessages((currentThreadMessages?.data as Message[]) || []);
  }, [currentThreadMessages, setMessages]);

  const handleJudge = async () => {
    if (!currentThread?.data.id) return;
    await judgeLesson({ threadId: currentThread.data.id });
  };

  const handleRetakeLesson = async () => {
    if (!currentThread?.data.id) return;

    setMessages([]);
    setShowRetakeModal(false);

    await retakeLesson({ lessonId });
  };

  const isSubmitted = status === "submitted";
  const isThreadActive = currentThread?.data.status === "active";

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="mx-auto flex size-full max-h-[70vh] w-full flex-col items-center py-4">
      <RetakeModal
        open={showRetakeModal}
        onOpenChange={setShowRetakeModal}
        onConfirm={handleRetakeLesson}
        onCancel={() => setShowRetakeModal(false)}
      />

      {isThreadLoading && <Loader />}
      <div className="flex w-full grow flex-col gap-y-4 overflow-y-auto">
        {messages.map((messages, idx) => (
          <ChatMessage key={idx} {...messages} />
        ))}

        {isSubmitted || (isJudgePending && <ChatLoader />)}
        <div ref={messagesEndRef} />
      </div>

      {isThreadActive && !isJudgePending && (
        <LessonForm
          handleSubmit={handleSubmit}
          handleInputChange={handleInputChange}
          input={input}
        />
      )}

      <hr className="mt-4 w-full border-t border-[#EDEDED]" />
      <div className="mt-4 flex w-full justify-center">
        {isThreadActive && !isJudgePending ? (
          <Button variant="primary" size="lg" className="max-w-fit gap-2" onClick={handleJudge}>
            {t("studentCourseView.lesson.aiMentorLesson.check")}
            <Icon name="ArrowRight" className="size-5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="max-w-fit gap-2"
            onClick={() => setShowRetakeModal(true)}
          >
            {t("studentCourseView.lesson.aiMentorLesson.retake")}
            <Icon name="ArrowRight" className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default AiMentorLesson;
