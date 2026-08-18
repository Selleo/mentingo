import { useChat, type UIMessage } from "@ai-sdk/react";
import { Link } from "@remix-run/react";
import {
  AI_MENTOR_PRACTICE_STATUSES,
  DASHBOARD_WIDGET_TYPES,
  createTextUiMessage,
  getUiMessageText,
  toUiMessageRole,
} from "@repo/shared";
import { Plus, SquareArrowRightEnter } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateAiMentorPractice } from "~/api/mutations/useCreateAiMentorPractice";
import { useRetryAiMentorPractice } from "~/api/mutations/useRetryAiMentorPractice";
import { useAiMentorPracticeToday } from "~/api/queries/useAiMentorPracticeToday";
import {
  getCurrentThreadMessagesQueryKey,
  useCurrentThreadMessages,
} from "~/api/queries/useCurrentThreadMessages";
import { queryClient } from "~/api/queryClient";
import { AiMentorReplayLoader } from "~/components/AiMentorReplayLoader";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { CourseGenerationComposerCenterContent } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationComposerCenterContent";
import { AiMentorPracticeMessages } from "~/modules/AiMentorPractice/components/AiMentorPracticeMessages";
import { createAiMentorChatTransport } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChatTransport";
import { LessonComposerCenterContent } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonComposerCenterContent";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../../../../e2e/data/ai-mentor-practice/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import type { GetThreadMessagesResponse } from "~/api/generated-api";

const PRACTICE_SUGGESTIONS = [
  {
    labelKey: "aiMentorPractice.form.suggestions.feedback.label",
    valueKey: "aiMentorPractice.form.suggestions.feedback.value",
  },
  {
    labelKey: "aiMentorPractice.form.suggestions.boundary.label",
    valueKey: "aiMentorPractice.form.suggestions.boundary.value",
  },
  {
    labelKey: "aiMentorPractice.form.suggestions.explanation.label",
    valueKey: "aiMentorPractice.form.suggestions.explanation.value",
  },
  {
    labelKey: "aiMentorPractice.form.suggestions.request.label",
    valueKey: "aiMentorPractice.form.suggestions.request.value",
  },
] as const;

type ScenarioComposerProps = {
  compact: boolean;
  currentPlaceholder: string;
  inputTestId?: string;
  isPending: boolean;
  onFocusChange: (focused: boolean) => void;
  onScenarioChange: (value: string) => void;
  onSubmit: () => void;
  scenario: string;
};

function ScenarioComposer({
  compact,
  currentPlaceholder,
  inputTestId,
  isPending,
  onFocusChange,
  onScenarioChange,
  onSubmit,
  scenario,
}: ScenarioComposerProps) {
  const { t } = useTranslation();

  return (
    <form
      className={cn(
        "rounded-xl border border-neutral-200 bg-white p-2 shadow-sm",
        compact && "rounded-lg",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700"
              aria-label={t("aiMentorPractice.form.suggestions.title")}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-[min(22rem,calc(100vw-3rem))] rounded-xl border-neutral-200 p-1.5 shadow-lg"
          >
            <DropdownMenuLabel className="px-2.5 py-2 text-xs font-semibold text-neutral-500">
              {t("aiMentorPractice.form.suggestions.title")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-neutral-100" />
            {PRACTICE_SUGGESTIONS.map(({ labelKey, valueKey }) => (
              <DropdownMenuItem
                key={valueKey}
                className="cursor-pointer rounded-lg px-2.5 py-2.5 outline-none transition-colors focus:bg-primary-50"
                onSelect={() => onScenarioChange(t(valueKey))}
              >
                <span className="min-w-0">
                  <span className="body-sm-md block text-neutral-900">{t(labelKey)}</span>
                  <span className="details mt-0.5 block line-clamp-2 text-neutral-500">
                    {t(valueKey)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <CourseGenerationComposerCenterContent
          isVoiceMode={false}
          input={scenario}
          currentPlaceholder={currentPlaceholder}
          voiceLevel={0}
          onInputChange={onScenarioChange}
          onSubmit={onSubmit}
          onFocusChange={onFocusChange}
          inputTestId={inputTestId}
          ariaLabel={t("aiMentorPractice.form.scenario")}
        />

        <Button
          type="submit"
          size="icon"
          className="size-8 rounded-lg"
          disabled={!scenario.trim() || isPending}
          data-testid={AI_MENTOR_PRACTICE_HANDLES.SUBMIT_BUTTON}
          aria-label={t("aiMentorPractice.form.submit")}
        >
          <Icon name="Send" className="size-4" />
        </Button>
      </div>
    </form>
  );
}

type ConversationComposerProps = {
  disabled: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
};

function ConversationComposer({
  disabled,
  message,
  onMessageChange,
  onSubmit,
}: ConversationComposerProps) {
  const { t } = useTranslation();

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <LessonComposerCenterContent
        isVoiceMode={false}
        compact
        input={message}
        placeholder={t("studentCourseView.lesson.aiMentorLesson.sendMessage")}
        voiceLevel={0}
        onInputChange={(event) => onMessageChange(event.target.value)}
        onSubmit={onSubmit}
        ariaLabel={t("aiMentorPractice.message")}
      />
      <Button
        type="submit"
        size="icon"
        className="size-8 shrink-0 rounded-lg"
        disabled={disabled || !message.trim()}
        aria-label={t("aiMentorPractice.send")}
      >
        <Icon name="Send" className="size-4" />
      </Button>
    </form>
  );
}

export function WidgetStudentAiMentorPractice() {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const language = useLanguageStore((state) => state.language);
  const { data, isLoading, isError, refetch } = useAiMentorPracticeToday();
  const { mutateAsync: createPractice, isPending: isCreating } = useCreateAiMentorPractice();
  const { mutateAsync: retryPractice, isPending: isRetrying } = useRetryAiMentorPractice();
  const [scenario, setScenario] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isScenarioFocused, setIsScenarioFocused] = useState(false);
  const [message, setMessage] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const placeholders = useMemo(() => PRACTICE_SUGGESTIONS.map(({ valueKey }) => t(valueKey)), [t]);
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE];
  const threadId = data?.threadId ?? "";
  const { data: persistedMessages, isLoading: isMessagesLoading } = useCurrentThreadMessages({
    isThreadLoading: !threadId,
    threadId,
  });
  const transport = useMemo(() => createAiMentorChatTransport(threadId), [threadId]);
  const { messages, setMessages, sendMessage, status } = useChat({
    transport,
    onFinish: async () => {
      if (!threadId) return;

      await queryClient.invalidateQueries({
        queryKey: getCurrentThreadMessagesQueryKey(threadId),
      });
    },
  });

  useEffect(() => {
    if (
      scenario.trim().length > 0 ||
      isScenarioFocused ||
      shouldReduceMotion ||
      placeholders.length < 2
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % placeholders.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [isScenarioFocused, placeholders.length, scenario, shouldReduceMotion]);

  useEffect(() => {
    if (!persistedMessages?.data || messages.length > 0) return;

    setMessages(
      persistedMessages.data.map((item) =>
        createTextUiMessage<UIMessage>({
          id: item.id,
          role: toUiMessageRole<UIMessage["role"]>(item.role),
          content: item.content,
        }),
      ),
    );
  }, [messages.length, persistedMessages, setMessages]);

  useEffect(() => {
    if (!threadId || messages.length === 0) return;

    queryClient.setQueryData<GetThreadMessagesResponse>(
      getCurrentThreadMessagesQueryKey(threadId),
      {
        data: messages
          .map((item) => ({
            id: item.id,
            role: item.role,
            content: getUiMessageText(item),
          }))
          .filter((item) => item.content.trim().length > 0),
      },
    );
  }, [messages, threadId]);

  useEffect(() => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  }, [messages, shouldReduceMotion]);

  const handleCreate = async () => {
    const value = scenario.trim();
    if (!value || isCreating) return;
    await createPractice({ scenario: value, language });
    setScenario("");
  };

  const isSending = status === "submitted" || status === "streaming";
  const handleSend = () => {
    const value = message.trim();
    if (!value || !threadId || isSending) return;
    setMessage("");
    void sendMessage({ text: value });
  };

  const isActive = data?.threadStatus === "active";
  const lastMessage = messages[messages.length - 1];
  const showChatLoader =
    isSending &&
    !(lastMessage?.role === "assistant" && getUiMessageText(lastMessage).trim().length > 0);

  return (
    <DashboardWidgetCard testId={AI_MENTOR_PRACTICE_HANDLES.WIDGET} className="h-full">
      <DashboardWidgetHeader
        title={t(metadata.titleKey)}
        icon={metadata.icon}
        iconClassName={metadata.iconClassName}
        iconContainerClassName={metadata.iconContainerClassName}
        headerAction={
          data ? (
            <Link
              to={`/ai-mentor/practice/${data.id}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-primary-800 transition-[color,transform] duration-75 hover:text-primary-950 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 motion-reduce:transition-none"
              aria-label={t("dashboardHome.widgets.studentTiles.aiMentorPractice.continueCta")}
              title={t("dashboardHome.widgets.studentTiles.aiMentorPractice.continueCta")}
            >
              <SquareArrowRightEnter className="size-4" aria-hidden="true" />
            </Link>
          ) : undefined
        }
      />
      <DashboardWidgetContent className="relative flex min-h-0 flex-col !overflow-hidden">
        {isLoading || isError ? (
          <DashboardWidgetQueryState
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
          />
        ) : !data ? (
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
            <div className="max-w-2xl">
              <p className="body-base-md text-neutral-950">
                {t("dashboardHome.widgets.studentTiles.aiMentorPractice.emptyPrompt")}
              </p>
              <p className="body-sm mt-1 text-neutral-500">
                {t("aiMentorPractice.form.scenarioHint")}
              </p>
            </div>
            <div className="mt-auto w-full">
              <ScenarioComposer
                compact={false}
                currentPlaceholder={
                  placeholders[placeholderIndex] ?? t("aiMentorPractice.form.scenarioPlaceholder")
                }
                inputTestId={AI_MENTOR_PRACTICE_HANDLES.SCENARIO_INPUT}
                isPending={isCreating}
                scenario={scenario}
                onScenarioChange={setScenario}
                onFocusChange={setIsScenarioFocused}
                onSubmit={() => void handleCreate()}
              />
            </div>
          </div>
        ) : data.status === AI_MENTOR_PRACTICE_STATUSES.QUEUED ||
          data.status === AI_MENTOR_PRACTICE_STATUSES.PROCESSING ? (
          <AiMentorReplayLoader
            text={t(`dashboardHome.widgets.studentTiles.aiMentorPractice.status.${data.status}`)}
            className="py-5"
          />
        ) : data.status === AI_MENTOR_PRACTICE_STATUSES.FAILED ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
            <p className="body-sm text-neutral-600">
              {t("dashboardHome.widgets.studentTiles.aiMentorPractice.status.failed")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRetrying}
              onClick={() => void retryPractice(data.id)}
            >
              {isRetrying ? t("common.button.loading") : t("aiMentorPractice.retry")}
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-neutral-100 px-4 py-2.5">
              <p className="body-sm-md truncate text-neutral-900">
                {data.title ?? t("dashboardHome.widgets.studentTiles.aiMentorPractice.emptyPrompt")}
              </p>
            </div>

            <AiMentorPracticeMessages
              messages={messages}
              isMessagesLoading={isMessagesLoading}
              showChatLoader={showChatLoader}
              aiMentorName={data.aiMentorName ?? t("aiMentorPractice.mentorName")}
              messagesContainerRef={messagesContainerRef}
            />

            {isActive && (
              <div className="shrink-0 border-t border-neutral-100 bg-neutral-50/70 px-3 py-2.5">
                <ConversationComposer
                  disabled={isSending}
                  message={message}
                  onMessageChange={setMessage}
                  onSubmit={handleSend}
                />
              </div>
            )}
          </div>
        )}
      </DashboardWidgetContent>
    </DashboardWidgetCard>
  );
}
