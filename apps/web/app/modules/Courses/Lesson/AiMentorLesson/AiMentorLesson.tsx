import { type Message, useChat } from "@ai-sdk/react";
import { useParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useJudgeLesson } from "~/api/mutations/useJudgeLesson";
import { useRetakeLesson } from "~/api/mutations/useRetakeLesson";
import { useCurrentThreadMessages } from "~/api/queries/useCurrentThreadMessages";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import Loader from "~/modules/common/Loader/Loader";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { LessonForm } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonForm";
import RetakeModal from "~/modules/Courses/Lesson/AiMentorLesson/components/RetakeModal";

import type { GetLessonByIdResponse } from "~/api/generated-api";

interface AiMentorLessonProps {
  lesson: GetLessonByIdResponse["data"];
  lessonLoading: boolean;
}

const AiMentorLesson = ({ lesson, lessonLoading }: AiMentorLessonProps) => {
  const { t } = useTranslation();
  const { courseId = "" } = useParams();

  const { mutateAsync: judgeLesson, isPending: isJudgePending } = useJudgeLesson(
    lesson.id,
    courseId,
  );
  const { mutateAsync: retakeLesson } = useRetakeLesson(lesson.id, courseId);

  const { data: currentThreadMessages } = useCurrentThreadMessages(
    lesson.id,
    lessonLoading,
    lesson.threadId,
  );

  const [showRetakeModal, setShowRetakeModal] = useState(false);

  const { messages, input, setMessages, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/ai/chat",
    body: {
      threadId: lesson.threadId ?? "",
    },
    fetch: async (url, options) => {
      const body = JSON.parse(options?.body as string);
      return fetch(url, {
        ...options,
        body: JSON.stringify({
          content: body.messages[body.messages.length - 1]?.content || "",
          threadId: lesson.threadId ?? "",
        }),
      });
    },
  });

  useEffect(() => {
    setMessages((currentThreadMessages?.data as Message[]) || []);
  }, [currentThreadMessages, setMessages]);

  const handleJudge = async () => {
    if (!lesson.threadId) return;
    await judgeLesson({ threadId: lesson.threadId });
  };

  const handleRetakeLesson = async () => {
    if (!lesson.threadId) return;

    setShowRetakeModal(false);

    await retakeLesson({ lessonId: lesson.id });
  };

  const isSubmitted = status === "submitted";
  const isThreadActive = lesson.status === "active";

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="mx-auto flex h-[85vh] max-h-[85vh] w-full flex-col items-center overflow-y-scroll py-4">
      <RetakeModal
        open={showRetakeModal}
        onOpenChange={setShowRetakeModal}
        onConfirm={handleRetakeLesson}
        onCancel={() => setShowRetakeModal(false)}
      />

      {lessonLoading && <Loader />}
      <div className="flex w-full grow flex-col gap-y-4 overflow-y-auto">
        {!lessonLoading && messages.map((messages, idx) => <ChatMessage key={idx} {...messages} />)}

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
