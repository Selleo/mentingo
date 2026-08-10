import { useChat, type UIMessage } from "@ai-sdk/react";
import { createTextUiMessage, getUiMessageText, toUiMessageRole } from "@repo/shared";
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
import { AiMentorReplayLoader } from "~/components/AiMentorReplayLoader";
import { PageWrapper } from "~/components/PageWrapper";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { AiMentorPracticeCompletion } from "~/modules/AiMentorPractice/components/AiMentorPracticeCompletion";
import { AiMentorPracticeComposer } from "~/modules/AiMentorPractice/components/AiMentorPracticeComposer";
import { AiMentorPracticeHeader } from "~/modules/AiMentorPractice/components/AiMentorPracticeHeader";
import { AiMentorPracticeMessages } from "~/modules/AiMentorPractice/components/AiMentorPracticeMessages";
import { AI_CHAT_STATUSES } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChat.constants";
import { createAiMentorChatTransport } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChatTransport";
import { AiMentorEvaluationDialog } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog";
import { AI_MENTOR_EVALUATION_CONTEXT } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog.types";
import { AiMentorEvaluationLoader } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationLoader";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../e2e/data/ai-mentor-practice/handles";

import type { GetPracticeResponse } from "~/api/generated-api";
import type { AiMentorEvaluation } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog.types";

type Practice = GetPracticeResponse["data"];

type AiMentorPracticeConversationProps = Pick<
  Practice,
  "id" | "threadId" | "threadStatus" | "title" | "aiMentorName" | "taskGoal" | "evaluation"
>;

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

        <AiMentorPracticeHeader title={title} taskGoal={taskGoal} />

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
            <AiMentorReplayLoader text={t("aiMentorPractice.replayLoadingTitle")} />
          ) : (
            <AiMentorPracticeMessages
              messages={messages}
              isMessagesLoading={isMessagesLoading}
              showChatLoader={showChatLoader}
              aiMentorName={aiMentorName ?? t("aiMentorPractice.mentorName")}
              messagesContainerRef={messagesContainerRef}
            />
          )}

          {isJudgePending && <AiMentorEvaluationLoader />}

          <div
            className={cn(
              "shrink-0 border-t border-neutral-200 bg-neutral-50/70 px-4 pb-4 pt-2 sm:px-5",
              isReplayPending && "hidden",
            )}
          >
            {isThreadActive && !isJudgePending && !isReplayPending ? (
              <AiMentorPracticeComposer
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
                hasLearnerMessage={hasLearnerMessage}
                isProcessing={isProcessing}
              />
            ) : (
              evaluation && (
                <AiMentorPracticeCompletion
                  isReplayPending={isReplayPending}
                  onViewFeedback={() => setShowEvaluationDialog(true)}
                  onPracticeAgain={() => void handleReplay()}
                />
              )
            )}
          </div>
        </section>
      </PageWrapper>
    </TooltipProvider>
  );
}
