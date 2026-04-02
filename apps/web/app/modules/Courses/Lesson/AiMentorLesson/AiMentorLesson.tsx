import { type Message, useChat } from "@ai-sdk/react";
import { useParams } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useJudgeLesson } from "~/api/mutations/useJudgeLesson";
import { useRetakeLesson } from "~/api/mutations/useRetakeLesson";
import { COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsAiMentorResults";
import {
  getCurrentThreadMessagesQueryKey,
  useCurrentThreadMessages,
} from "~/api/queries/useCurrentThreadMessages";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { LoaderWithTextSequence } from "~/components/LoaderWithTextSequence";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useOptionalCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { LessonForm } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonForm";
import RetakeModal from "~/modules/Courses/Lesson/AiMentorLesson/components/RetakeModal";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import type { GetLessonByIdResponse } from "~/api/generated-api";
import type { LessonPreviewUser } from "~/modules/Courses/Lesson/types";

const apiUrl = import.meta.env.VITE_API_URL;
const chatUrl = apiUrl ? `${apiUrl}/api/ai/chat` : "/api/ai/chat";

interface AiMentorLessonProps {
  lesson: GetLessonByIdResponse["data"];
  lessonLoading: boolean;
  previewUser?: LessonPreviewUser;
}

const AiMentorLesson = ({ lesson, lessonLoading, previewUser }: AiMentorLessonProps) => {
  const { t } = useTranslation();
  const { courseId = "" } = useParams();
  const courseExperience = useOptionalCourseAccessProvider();
  const isPreviewMode = courseExperience?.isPreviewMode ?? true;

  const { mutateAsync: judgeLesson, isPending: isJudgePending } = useJudgeLesson(
    lesson.id,
    courseId,
  );
  const { mutateAsync: retakeLesson } = useRetakeLesson(lesson.id, courseId);

  const { data: currentThreadMessages, isLoading: isCurrentThreadMessagesLoading } =
    useCurrentThreadMessages({
      isThreadLoading: lessonLoading,
      threadId: lesson.threadId,
    });

  const [showRetakeModal, setShowRetakeModal] = useState(false);

  const { messages, input, setMessages, handleInputChange, handleSubmit, status, setInput } =
    useChat({
      api: chatUrl,
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
          credentials: "include",
        });
      },
      onFinish: async () => {
        if (!lesson.threadId) return;

        await queryClient.invalidateQueries({
          queryKey: [COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY, { id: courseId }],
        });
        await queryClient.invalidateQueries({
          queryKey: getCurrentThreadMessagesQueryKey(lesson.threadId),
        });
      },
    });

  useEffect(() => {
    setMessages((currentThreadMessages?.data as Message[]) || []);
  }, [currentThreadMessages, setMessages]);

  const appendVoiceMessage = useCallback(
    (role: Message["role"], content: string) => {
      const nextContent = content.trim();
      if (!nextContent) {
        return;
      }

      const nextMessage: Message = {
        id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        role,
        content: nextContent,
      };

      setMessages((prev) => [...prev, nextMessage]);
    },
    [setMessages],
  );

  const invalidateCurrentThreadMessages = useCallback(() => {
    if (!lesson.threadId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: getCurrentThreadMessagesQueryKey(lesson.threadId),
    });
  }, [lesson.threadId]);

  const handleVoiceMentorTranscription = useCallback(
    (text: string) => {
      appendVoiceMessage("user", text);
    },
    [appendVoiceMessage],
  );

  const handleVoiceMentorResponseCompleted = useCallback(
    (text: string) => {
      appendVoiceMessage("assistant", text);
    },
    [appendVoiceMessage],
  );

  const handleJudge = async () => {
    if (!lesson.threadId) return;
    await judgeLesson({ threadId: lesson.threadId });
  };

  const handleRetakeLesson = async () => {
    if (!lesson.threadId) return;

    setShowRetakeModal(false);

    await retakeLesson({ lessonId: lesson.id });
  };

  const isProcessing = status === "submitted" || status === "streaming";
  const isThreadActive = lesson.status === "active";

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const hasTaskDescription = Boolean(
    lesson.description && stripHtmlTags(lesson.description).trim().length,
  );
  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistantText =
    lastMessage?.role === "assistant" && String(lastMessage.content ?? "").trim().length > 0;
  const showChatLoader = (isProcessing && !hasStreamingAssistantText) || isJudgePending;

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className={cn(
        "mx-auto flex h-[85vh] max-h-[85vh] w-full flex-col items-center overflow-y-scroll py-4",
        {
          "h-auto max-h-[65vh]": isPreviewMode,
        },
      )}
    >
      {!isPreviewMode && (
        <RetakeModal
          open={showRetakeModal}
          onOpenChange={setShowRetakeModal}
          onConfirm={handleRetakeLesson}
          onCancel={() => setShowRetakeModal(false)}
        />
      )}

      {lessonLoading || isCurrentThreadMessagesLoading ? (
        <LoaderWithTextSequence preset="aiMentor" />
      ) : null}

      {!lessonLoading && hasTaskDescription && (
        <Accordion type="single" collapsible defaultValue="task" className="w-full mb-10">
          <AccordionItem
            value="task"
            className="rounded-xl border border-l-4 border-primary-600 bg-white shadow-sm"
          >
            <AccordionTrigger className="group w-full items-start gap-3 px-4 py-3 text-left hover:no-underline">
              <div className="text-primary-700">
                <Icon name="BookOpen" className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-neutral-900">
                  {t("studentCourseView.lesson.aiMentorLesson.taskDescription")}
                </div>
                <div className="text-xs text-neutral-500 group-data-[state=open]:hidden">
                  {t("studentCourseView.lesson.aiMentorLesson.taskDescriptionExpand")}
                </div>
                <div className="text-xs text-neutral-500 group-data-[state=closed]:hidden">
                  {t("studentCourseView.lesson.aiMentorLesson.taskDescriptionCollapse")}
                </div>
              </div>
              <Icon
                name="ArrowDown"
                className="size-4 text-neutral-500 transition-transform group-data-[state=open]:rotate-180"
              />
            </AccordionTrigger>
            <AccordionContent className="px-4 py-4 text-neutral-800 border-t border-neutral-100">
              <div>{lesson.description}</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <div
        ref={messagesContainerRef}
        className="flex w-full grow max-w-full relative flex-col gap-y-4 overflow-y-scroll"
      >
        {!lessonLoading &&
          messages.map((messages, idx) => (
            <ChatMessage
              key={idx}
              aiName={lesson.aiMentor?.name || ""}
              avatarUrl={lesson.aiMentor?.avatarReferenceUrl}
              previewUser={previewUser}
              {...messages}
            />
          ))}

        {showChatLoader && (
          <ChatLoader
            aiName={lesson.aiMentor?.name || ""}
            avatarUrl={lesson.aiMentor?.avatarReferenceUrl}
          />
        )}
      </div>

      {isThreadActive && !isJudgePending && (
        <LessonForm
          lessonId={lesson.id}
          mentorName={
            lesson.aiMentor?.name || t("studentCourseView.lesson.aiMentorLesson.aiMentorName")
          }
          mentorAvatarUrl={lesson.aiMentor?.avatarReferenceUrl}
          handleSubmit={handleSubmit}
          onMentorTranscription={handleVoiceMentorTranscription}
          onMentorResponseCompleted={handleVoiceMentorResponseCompleted}
          onAudioInterrupted={invalidateCurrentThreadMessages}
          onAudioOutputCompleted={invalidateCurrentThreadMessages}
          handleInputChange={handleInputChange}
          input={input}
          setInput={setInput}
        />
      )}

      {!isPreviewMode && (
        <>
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
        </>
      )}
    </div>
  );
};

export default AiMentorLesson;
