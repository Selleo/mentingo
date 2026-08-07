import { useChat, type UIMessage } from "@ai-sdk/react";
import { createTextUiMessage, getUiMessageText, toUiMessageRole } from "@repo/shared";
import { BookOpen, ClipboardCheck, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useJudgePractice } from "~/api/mutations/useJudgePractice";
import { useReplayAiMentorPractice } from "~/api/mutations/useReplayAiMentorPractice";
import {
  getCurrentThreadMessagesQueryKey,
  useCurrentThreadMessages,
} from "~/api/queries/useCurrentThreadMessages";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { AI_CHAT_STATUSES } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChat.constants";
import { createAiMentorChatTransport } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChatTransport";
import { AiMentorEvaluationDialog } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog";
import { AI_MENTOR_EVALUATION_CONTEXT } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog.types";
import { AiMentorEvaluationLoader } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationLoader";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { LessonForm } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonForm";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../e2e/data/ai-mentor-practice/handles";

import type { GetPracticeResponse } from "~/api/generated-api";
import type { AiMentorEvaluation } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog.types";

type Practice = GetPracticeResponse["data"];

type AiMentorPracticeConversationProps = Pick<
  Practice,
  "id" | "threadId" | "threadStatus" | "title" | "aiMentorName" | "taskGoal" | "evaluation"
>;

function PracticeReplayLoader() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-0 flex-1 items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3">
          <span
            className="size-4 rounded-full border-2 border-neutral-200 border-t-primary-600 motion-safe:animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <p className="loading-text-shimmer text-base font-semibold">
            {t("aiMentorPractice.replayLoadingTitle")}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AiMentorPracticeConversation({
  id,
  threadId,
  threadStatus,
  title,
  aiMentorName,
  taskGoal,
  evaluation: persistedEvaluation,
}: AiMentorPracticeConversationProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [input, setInput] = useState("");
  const [latestEvaluation, setLatestEvaluation] = useState<AiMentorEvaluation | null>(null);
  const [showEvaluationDialog, setShowEvaluationDialog] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hydratedThreadRef = useRef<string | null>(null);
  const resolvedThreadId = threadId ?? "";
  const transport = useMemo(
    () => createAiMentorChatTransport(resolvedThreadId),
    [resolvedThreadId],
  );
  const { mutateAsync: judgePractice, isPending: isJudgePending } = useJudgePractice(id);
  const { mutateAsync: replayPractice, isPending: isReplayPending } = useReplayAiMentorPractice(id);
  const { data: currentThreadMessages, isLoading: isMessagesLoading } = useCurrentThreadMessages({
    isThreadLoading: !resolvedThreadId,
    threadId: resolvedThreadId,
  });
  const { messages, setMessages, sendMessage, status } = useChat({
    transport,
    onFinish: async () => {
      if (!resolvedThreadId) return;

      await queryClient.invalidateQueries({
        queryKey: getCurrentThreadMessagesQueryKey(resolvedThreadId),
      });
    },
  });

  useEffect(() => {
    if (isReplayPending || !currentThreadMessages || hydratedThreadRef.current === resolvedThreadId)
      return;

    setMessages(
      currentThreadMessages.data.map((message) =>
        createTextUiMessage<UIMessage>({
          id: message.id,
          role: toUiMessageRole<UIMessage["role"]>(message.role),
          content: message.content,
        }),
      ),
    );
    hydratedThreadRef.current = resolvedThreadId;
  }, [currentThreadMessages, isReplayPending, resolvedThreadId, setMessages]);

  const appendVoiceMessage = useCallback(
    (role: UIMessage["role"], content: string) => {
      const nextContent = content.trim();
      if (!nextContent) return;

      setMessages((current) => [
        ...current,
        createTextUiMessage<UIMessage>({
          id: `practice-voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          role,
          content: nextContent,
        }),
      ]);
    },
    [setMessages],
  );

  const invalidateMessages = useCallback(() => {
    if (!resolvedThreadId) return;

    void queryClient.invalidateQueries({
      queryKey: getCurrentThreadMessagesQueryKey(resolvedThreadId),
    });
  }, [resolvedThreadId]);

  const isProcessing =
    status === AI_CHAT_STATUSES.SUBMITTED || status === AI_CHAT_STATUSES.STREAMING;
  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistantText =
    lastMessage?.role === "assistant" && getUiMessageText(lastMessage).trim().length > 0;
  const showChatLoader = isProcessing && !hasStreamingAssistantText;
  const hasLearnerMessage = messages.some((message) => message.role === "user");
  const isThreadActive = threadStatus === "active";
  const evaluation = latestEvaluation ?? persistedEvaluation;
  const isCompactConversation = messages.length <= 1 && !isProcessing;

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 160) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: shouldReduceMotion || isProcessing ? "auto" : "smooth",
    });
  }, [isProcessing, messages, shouldReduceMotion]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const message = input.trim();
    if (!message || !resolvedThreadId || isProcessing || !isThreadActive) return;

    setInput("");
    void sendMessage({ text: message });
  }, [input, isProcessing, isThreadActive, resolvedThreadId, sendMessage]);

  const handleJudge = useCallback(async () => {
    if (!resolvedThreadId || !hasLearnerMessage) return;

    const response = await judgePractice({ threadId: resolvedThreadId });
    const refreshedPractice = queryClient.getQueryData<Practice>(["aiMentorPractice", id]);
    setLatestEvaluation(refreshedPractice?.evaluation ?? response.data);
    setShowEvaluationDialog(true);
  }, [hasLearnerMessage, id, judgePractice, resolvedThreadId]);

  const handleReplay = useCallback(async () => {
    setShowEvaluationDialog(false);
    setLatestEvaluation(null);
    setMessages([]);
    hydratedThreadRef.current = null;
    await replayPractice();
  }, [replayPractice, setMessages]);

  return (
    <TooltipProvider delayDuration={0}>
      <PageWrapper
        breadcrumbs={[
          { title: t("navigationSideBar.dashboard"), href: "/dashboard" },
          { title: t("aiMentorPractice.conversationTitle"), href: `/ai-mentor/practice/${id}` },
        ]}
        className="mx-auto flex h-[calc(100dvh-2rem)] max-w-5xl flex-col overflow-hidden pb-6"
      >
        {evaluation && (
          <AiMentorEvaluationDialog
            evaluation={evaluation}
            open={showEvaluationDialog}
            onOpenChange={setShowEvaluationDialog}
            context={AI_MENTOR_EVALUATION_CONTEXT.PRACTICE}
          />
        )}

        <header className="w-full shrink-0 pb-5">
          <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="h3 max-w-3xl text-balance text-neutral-950">
              {title || t("aiMentorPractice.conversationTitle")}
            </h1>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  data-testid={AI_MENTOR_PRACTICE_HANDLES.TASK_BUTTON}
                  variant="outline"
                  size="sm"
                  className="w-fit shrink-0 gap-2 rounded-md border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-800 shadow-none hover:border-primary-200 hover:bg-primary-50 hover:text-primary-800"
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
                </Button>
              </DialogTrigger>
              <DialogContent variant="mobileDrawer" className="flex flex-col sm:!max-w-xl">
                <DialogHeader className="border-b border-neutral-100 px-6 py-4 text-left">
                  <DialogTitle className="text-lg font-semibold text-neutral-950">
                    {t("studentCourseView.lesson.aiMentorLesson.taskDescription")}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {t("studentCourseView.lesson.aiMentorLesson.taskDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="px-6 py-5">
                  {taskGoal ? (
                    <Viewer content={taskGoal} style="prose" className="body-sm text-neutral-800" />
                  ) : (
                    <p className="body-sm leading-relaxed text-neutral-800">
                      {t("aiMentorPractice.successGoalFallback")}
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <section
          data-testid={AI_MENTOR_PRACTICE_HANDLES.CONVERSATION}
          aria-label={t("aiMentorPractice.conversationTitle")}
          className={cn(
            "flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]",
            isCompactConversation
              ? "h-[min(32rem,calc(100dvh-14rem))] min-h-[22rem]"
              : "min-h-[28rem] flex-1",
          )}
        >
          {isReplayPending ? (
            <PracticeReplayLoader />
          ) : (
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
                      aiName={aiMentorName ?? t("aiMentorPractice.mentorName")}
                      messageMaxWidthClass="max-w-[92%] sm:max-w-[78%]"
                    />
                  ))}
                {showChatLoader && (
                  <ChatLoader aiName={aiMentorName ?? t("aiMentorPractice.mentorName")} />
                )}
              </div>
            </div>
          )}

          {isJudgePending && <AiMentorEvaluationLoader />}

          <div
            className={cn(
              "shrink-0 border-t border-neutral-200 bg-neutral-50/70 px-4 pb-4 pt-2 sm:px-5",
              isReplayPending && "hidden",
            )}
          >
            {isThreadActive && !isJudgePending && !isReplayPending ? (
              <>
                <LessonForm
                  lessonId={id}
                  mentorName={aiMentorName ?? t("aiMentorPractice.mentorName")}
                  handleSubmit={handleSubmit}
                  onMentorTranscription={(text) => appendVoiceMessage("user", text)}
                  onMentorResponseCompleted={(text) => appendVoiceMessage("assistant", text)}
                  onAudioInterrupted={invalidateMessages}
                  onAudioOutputCompleted={invalidateMessages}
                  onJudge={handleJudge}
                  isJudgePending={isJudgePending}
                  handleInputChange={handleInputChange}
                  messages={messages}
                  input={input}
                  setInput={setInput}
                  hasTaskDescription={Boolean(taskGoal)}
                  taskDescription={taskGoal ?? ""}
                  allowVoiceMentor={false}
                  compact
                />
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="details text-neutral-500">
                    {hasLearnerMessage
                      ? t("aiMentorPractice.checkHint")
                      : t("aiMentorPractice.startHint")}
                  </p>
                  <Button
                    type="button"
                    data-testid={AI_MENTOR_PRACTICE_HANDLES.CHECK_BUTTON}
                    size="sm"
                    className="shrink-0 gap-2 motion-safe:active:scale-[0.98] motion-reduce:transform-none"
                    disabled={!hasLearnerMessage || isProcessing}
                    onClick={() => void handleJudge()}
                  >
                    {t("aiMentorPractice.checkPractice")}
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </>
            ) : (
              evaluation && (
                <div className="flex flex-wrap items-center gap-3 py-2">
                  <p className="body-sm-md text-neutral-800">
                    {t("aiMentorPractice.practiceComplete")}
                  </p>
                  <div className="ml-auto flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={AI_MENTOR_PRACTICE_HANDLES.VIEW_FEEDBACK_BUTTON}
                        onClick={() => setShowEvaluationDialog(true)}
                    >
                      {t("aiMentorPractice.viewFeedback")}
                    </Button>
                      <Button
                        size="sm"
                        data-testid={AI_MENTOR_PRACTICE_HANDLES.PRACTICE_AGAIN_BUTTON}
                        className="gap-2"
                      disabled={isReplayPending}
                      onClick={() => void handleReplay()}
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      {t("aiMentorPractice.practiceAgain")}
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      </PageWrapper>
    </TooltipProvider>
  );
}
