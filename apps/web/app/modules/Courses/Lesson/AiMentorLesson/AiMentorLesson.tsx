import { useChat, type UIMessage } from "@ai-sdk/react";
import { useParams } from "@remix-run/react";
import { createTextUiMessage, getUiMessageText, toUiMessageRole } from "@repo/shared";
import { BookOpen, CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useOptionalCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { createAiMentorChatTransport } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChatTransport";
import { AiMentorEvaluationDialog } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog";
import { AiMentorEvaluationLoader } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationLoader";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { LessonForm } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonForm";
import RetakeModal from "~/modules/Courses/Lesson/AiMentorLesson/components/RetakeModal";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import type { GetLessonByIdResponse } from "~/api/generated-api";
import type { AiMentorEvaluation } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog.types";
import type { LessonPreviewUser } from "~/modules/Courses/Lesson/types";

const taskDescriptionViewerClassName =
  "max-h-[62vh] overflow-y-auto pr-2 text-left text-sm leading-relaxed text-neutral-800";

const hasEvaluationData = (evaluation?: AiMentorEvaluation | null) =>
  Boolean(evaluation && (typeof evaluation.passed === "boolean" || evaluation.score != null));

interface AiMentorLessonProps {
  lesson: GetLessonByIdResponse["data"];
  lessonLoading: boolean;
  previewUser?: LessonPreviewUser;
  hideControls?: boolean;
  autoOpenTaskDescription?: boolean;
}

const AiMentorLesson = ({
  lesson,
  lessonLoading,
  previewUser,
  hideControls = false,
  autoOpenTaskDescription = true,
}: AiMentorLessonProps) => {
  const { t } = useTranslation();
  const { courseId = "" } = useParams();
  const courseExperience = useOptionalCourseAccessProvider();
  const isPreviewMode = courseExperience?.isPreviewMode ?? true;

  const { mutateAsync: judgeLesson, isPending: isJudgePending } = useJudgeLesson(lesson.id);
  const { mutateAsync: retakeLesson } = useRetakeLesson(lesson.id, courseId);

  const { data: currentThreadMessages, isLoading: isCurrentThreadMessagesLoading } =
    useCurrentThreadMessages({
      isThreadLoading: lessonLoading,
      threadId: lesson.threadId,
    });

  const [showRetakeModal, setShowRetakeModal] = useState(false);
  const [showEvaluationDialog, setShowEvaluationDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<AiMentorEvaluation | null>(null);
  const [input, setInput] = useState("");
  const taskDialogLessonIdRef = useRef<string | null>(null);

  const transport = useMemo(
    () => createAiMentorChatTransport(lesson.threadId ?? ""),
    [lesson.threadId],
  );

  const { messages, setMessages, sendMessage, status } = useChat({
    transport,
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
    setMessages(
      currentThreadMessages?.data.map((message) =>
        createTextUiMessage<UIMessage>({
          id: message.id,
          role: toUiMessageRole<UIMessage["role"]>(message.role),
          content: message.content,
        }),
      ) ?? [],
    );
  }, [currentThreadMessages, setMessages]);

  const appendVoiceMessage = useCallback(
    (role: UIMessage["role"], content: string) => {
      const nextContent = content.trim();
      if (!nextContent) {
        return;
      }

      const nextMessage = createTextUiMessage<UIMessage>({
        id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        role,
        content: nextContent,
      });

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

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const message = input.trim();
    if (!message || !lesson.threadId) return;

    setInput("");
    void sendMessage({ text: message });
  }, [input, lesson.threadId, sendMessage]);

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

  const handleJudge = useCallback(async () => {
    if (!lesson.threadId) return;
    const response = await judgeLesson({ threadId: lesson.threadId });
    setLatestEvaluation(response.data);
    setShowEvaluationDialog(true);
  }, [judgeLesson, lesson.threadId]);

  const handleRetakeLesson = async () => {
    if (!lesson.threadId) return;

    setShowRetakeModal(false);
    setLatestEvaluation(null);
    setShowEvaluationDialog(false);

    await retakeLesson({ lessonId: lesson.id });
  };

  const isProcessing = status === "submitted" || status === "streaming";
  const isThreadActive = lesson.status === "active";

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const hasTaskDescription = Boolean(
    lesson.description && stripHtmlTags(lesson.description).trim().length,
  );
  const isLessonCompleted = lesson.lessonCompleted === true;
  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistantText =
    lastMessage?.role === "assistant" && getUiMessageText(lastMessage).trim().length > 0;
  const showChatLoader = isProcessing && !hasStreamingAssistantText;
  const persistedEvaluation = useMemo<AiMentorEvaluation | null>(() => {
    if (!lesson.aiMentorDetails) return null;

    return {
      ...lesson.aiMentorDetails,
    };
  }, [lesson.aiMentorDetails]);
  const evaluation = latestEvaluation ?? persistedEvaluation;
  const shouldShowEvaluation = hasEvaluationData(evaluation);
  const shouldAutoOpenTaskDescription =
    !isLessonCompleted && !shouldShowEvaluation && hasTaskDescription;

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!shouldAutoOpenTaskDescription) setShowTaskDialog(false);
  }, [shouldAutoOpenTaskDescription]);

  useEffect(() => {
    if (
      !autoOpenTaskDescription ||
      lessonLoading ||
      !shouldAutoOpenTaskDescription ||
      taskDialogLessonIdRef.current === lesson.id
    ) {
      return;
    }

    taskDialogLessonIdRef.current = lesson.id;
    setShowTaskDialog(true);
  }, [autoOpenTaskDescription, lesson.id, lessonLoading, shouldAutoOpenTaskDescription]);

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "mx-auto flex h-[85vh] max-h-[85vh] min-h-[32rem] w-full flex-col items-center overflow-hidden py-3",
          {
            "h-auto max-h-[85vh]": isPreviewMode,
          },
        )}
      >
        <RetakeModal
          open={showRetakeModal}
          onOpenChange={setShowRetakeModal}
          onConfirm={handleRetakeLesson}
          onCancel={() => setShowRetakeModal(false)}
        />
        {shouldShowEvaluation && evaluation && (
          <AiMentorEvaluationDialog
            evaluation={evaluation}
            open={showEvaluationDialog}
            onOpenChange={setShowEvaluationDialog}
          />
        )}
        {hasTaskDescription && !lessonLoading && (
          <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
            <DialogContent
              variant="mobileDrawer"
              data-testid={LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION_DIALOG}
              className="flex flex-col sm:!max-w-2xl"
            >
              <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
                <DialogTitle className="text-lg font-semibold text-neutral-950">
                  {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t("studentCourseView.lesson.aiMentorLesson.taskDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 px-6 py-5">
                <div className={taskDescriptionViewerClassName}>
                  <Viewer content={lesson.description ?? ""} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {(lessonLoading || isCurrentThreadMessagesLoading) && (
          <LoaderWithTextSequence preset="aiMentor" />
        )}

        {!lessonLoading && !hideControls && (
          <div className="mb-5 grid w-full grid-cols-2 gap-2 border-b border-neutral-100 pb-3">
            <Button
              data-testid={LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION}
              type="button"
              variant="outline"
              className="h-9 min-w-0 justify-center gap-2 rounded-md border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-800 shadow-none hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800 sm:text-sm"
              disabled={!hasTaskDescription}
              onClick={() => setShowTaskDialog(true)}
            >
              <BookOpen className="size-4 shrink-0" />
              <span className="truncate">
                {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
              </span>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="min-w-0">
                  <Button
                    data-testid={LEARNING_HANDLES.AI_MENTOR_RESULT_BUTTON}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-9 w-full min-w-0 justify-center gap-2 rounded-md border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-800 shadow-none hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800 disabled:pointer-events-none disabled:text-neutral-400 sm:text-sm",
                      {
                        "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800":
                          evaluation?.passed === true,
                        "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800":
                          evaluation?.passed === false,
                      },
                    )}
                    disabled={!shouldShowEvaluation}
                    onClick={() => setShowEvaluationDialog(true)}
                  >
                    {evaluation?.passed === true ? (
                      <CheckCircle2 className="size-4 shrink-0" />
                    ) : evaluation?.passed === false ? (
                      <XCircle className="size-4 shrink-0" />
                    ) : (
                      <ClipboardCheck className="size-4 shrink-0" />
                    )}
                    <span className="truncate">
                      {t("studentCourseView.lesson.aiMentorLesson.resultButton")}
                    </span>
                  </Button>
                </span>
              </TooltipTrigger>
              {!shouldShowEvaluation && (
                <TooltipContent
                  side="bottom"
                  align="center"
                  className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                >
                  {t("studentCourseView.lesson.aiMentorLesson.resultButtonDisabledTooltip")}
                  <TooltipArrow className="fill-black" />
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        <div
          data-testid={LEARNING_HANDLES.AI_MENTOR_MESSAGES}
          ref={messagesContainerRef}
          className="flex w-full grow max-w-full relative flex-col gap-y-4 overflow-y-scroll"
        >
          {!lessonLoading &&
            messages.map((message, idx) => (
              <ChatMessage
                key={idx}
                aiName={lesson.aiMentor?.name || ""}
                avatarUrl={lesson.aiMentor?.avatarReferenceUrl}
                previewUser={previewUser}
                testId={LEARNING_HANDLES.aiMentorMessage(message.id)}
                contentTestId={LEARNING_HANDLES.aiMentorMessageRole(message.role)}
                id={message.id}
                role={message.role}
                parts={message.parts}
              />
            ))}

          {showChatLoader && (
            <ChatLoader
              aiName={lesson.aiMentor?.name || ""}
              avatarUrl={lesson.aiMentor?.avatarReferenceUrl}
            />
          )}
        </div>

        {isJudgePending && <AiMentorEvaluationLoader />}

        {isThreadActive && !isJudgePending && !hideControls && (
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
            onJudge={handleJudge}
            isJudgePending={isJudgePending}
            handleInputChange={handleInputChange}
            messages={messages}
            input={input}
            setInput={setInput}
            hasTaskDescription={hasTaskDescription}
            taskDescription={lesson.description ?? ""}
          />
        )}

        {!hideControls && (
          <>
            <hr className="mt-4 w-full border-t border-[#EDEDED]" />
            <div className="mt-4 flex w-full justify-center">
              {isThreadActive && !isJudgePending && (
                <Button
                  data-testid={LEARNING_HANDLES.AI_MENTOR_CHECK_BUTTON}
                  variant="primary"
                  size="lg"
                  className="max-w-fit gap-2"
                  onClick={() => void handleJudge()}
                >
                  {t("studentCourseView.lesson.aiMentorLesson.check")}
                  <Icon name="ArrowRight" className="size-5" />
                </Button>
              )}
              {!isThreadActive && !isJudgePending && (
                <Button
                  data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_BUTTON}
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
    </TooltipProvider>
  );
};

export default AiMentorLesson;
