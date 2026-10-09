/** Renders the assistant transcript from durable parts in event order. */
import { getUiMessageText } from "@repo/shared";
import { Check, CircleAlert, FileText, RotateCcw } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { TypingDots } from "~/components/TypingDots";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { variants } from "~/modules/Courses/Lesson/AiMentorLesson/components/variants";

import { projectAuthoringTimeline } from "../authoringConversation";
import { compactLinkSeparators, extractTrailingSources } from "../authoringSources";

import { AuthoringToolActivity } from "./AuthoringActivityRail";
import { AuthoringCollapsibleSection } from "./AuthoringCollapsibleSection";
import { AuthoringLivePreview } from "./AuthoringLivePreview";
import { AuthoringMarkdownLink, AuthoringSourceChipRow } from "./AuthoringSourceCitation";

import type { AuthoringChatMessage } from "../authoringChatTransport";
import type { AuthoringTimelineDecoration } from "../authoringConversation";
import type { PreviewView, QuestionView, SourceView } from "../courseAuthoring.types";

type PendingTask = { taskId: string; requestId: string; phaseLabel?: string };
type PlanView = {
  id: string;
  requestId: string;
  taskId: string | null;
  partId: string | null;
  firstSequence?: number;
  message: string;
  planSteps: string[];
};
type TaskActivity = {
  taskId: string;
  requestId: string;
  sequence?: number;
  toolsIncluded?: boolean;
  content: ReactNode;
};
type ProposalGroup = {
  taskId: string;
  requestId: string;
  proposalIds: string[];
  content: ReactNode;
};

type Props = {
  chatMessages: AuthoringChatMessage[];
  pendingTasks?: PendingTask[];
  taskActivities?: TaskActivity[];
  taskLabels?: Record<string, string>;
  plans?: PlanView[];
  proposalById?: Record<string, ReactNode>;
  proposalGroups?: ProposalGroup[];
  previews?: PreviewView[];
  sources?: SourceView[];
  onPreviewInCurriculum?: (preview: PreviewView) => void;
  questionsByRequest?: Record<string, QuestionView[]>;
  onAnswerQuestion?: (question: QuestionView, answer: string) => Promise<void>;
  chatError?: Error;
  onRetryChat?: () => void;
};

type ChatPart = AuthoringChatMessage["parts"][number];
type PartMarker = Extract<ChatPart, { type: "data-authoringPart" }>;

const isPartMarker = (part: ChatPart): part is PartMarker => part.type === "data-authoringPart";

const AuthoringQuestionCard = ({
  question,
  onAnswer,
  hidePrompt = false,
}: {
  question: QuestionView;
  onAnswer?: (question: QuestionView, answer: string) => Promise<void>;
  hidePrompt?: boolean;
}) => {
  const { t } = useTranslation();
  const [answerText, setAnswerText] = useState("");
  const [localAnswer, setLocalAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otherSelected, setOtherSelected] = useState(false);
  const resolvedAnswer = question.answer ?? localAnswer;
  const resolved = question.answered || resolvedAnswer !== null;
  const capability = question.capability !== null;
  let resolvedLabel = t("courseAuthoring.conversation.questionAnswered");
  if (question.capability === "deep_research") {
    resolvedLabel =
      resolvedAnswer === "allow"
        ? t("courseAuthoring.conversation.deepResearchAllowed")
        : t("courseAuthoring.conversation.deepResearchDenied");
  } else if (capability) {
    resolvedLabel =
      resolvedAnswer === "allow"
        ? t("courseAuthoring.conversation.capabilityAllowed")
        : t("courseAuthoring.conversation.capabilityDenied");
  }

  const submit = async (answer: string) => {
    if (!answer || submitting || resolved || !onAnswer) return;
    setSubmitting(true);
    try {
      await onAnswer(question, answer);
      setLocalAnswer(answer);
    } catch {
      // The owning session has already reported the durable command error.
    } finally {
      setSubmitting(false);
    }
  };

  let responseNode: ReactNode;
  if (resolved) {
    responseNode = (
      <div
        className={cn(
          "items-center gap-1.5 text-xs text-neutral-600",
          capability ? "inline-flex" : "mt-2 flex",
        )}
        role="status"
      >
        <Check className="size-3.5 text-success-700" aria-hidden="true" />
        {capability || !resolvedAnswer ? (
          <span>{resolvedLabel}</span>
        ) : (
          <>
            <span className="font-medium">{t("courseAuthoring.activityRail.yourAnswer")}:</span>{" "}
            <span className="min-w-0 whitespace-pre-wrap break-words">{resolvedAnswer}</span>
          </>
        )}
      </div>
    );
  } else if (capability) {
    responseNode = (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 border-primary-300 bg-primary-50 px-2.5 font-medium text-primary-800 hover:border-primary-500 hover:bg-primary-100"
          disabled={submitting || !onAnswer}
          onClick={() => void submit("allow")}
        >
          {t("courseAuthoring.conversation.allow")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 border-neutral-300 bg-white px-2.5 text-neutral-700 hover:border-neutral-500 hover:bg-neutral-100"
          disabled={submitting || !onAnswer}
          onClick={() => void submit("deny")}
        >
          {t("courseAuthoring.conversation.deny")}
        </Button>
      </div>
    );
  } else if (question.choices.length > 0) {
    responseNode = (
      <div className="mt-3 space-y-1.5">
        {question.choices.slice(0, 3).map((choice, index) => (
          <button
            key={choice}
            type="button"
            className="flex w-full items-start gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-left text-sm text-neutral-800 hover:border-primary-400 hover:bg-primary-50"
            disabled={submitting || !onAnswer}
            onClick={() => void submit(choice)}
          >
            <span className="shrink-0 font-semibold text-primary-700">
              {String.fromCharCode(65 + index)}.
            </span>
            <span className="min-w-0 flex-1 whitespace-normal break-words">{choice}</span>
          </button>
        ))}
        <button
          type="button"
          className="flex w-full items-start gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-left text-sm text-neutral-800 hover:border-primary-400 hover:bg-primary-50"
          disabled={submitting || !onAnswer}
          onClick={() => setOtherSelected(true)}
        >
          <span className="font-semibold text-primary-700">D.</span>
          <span>{t("courseAuthoring.conversation.questionOther")}</span>
        </button>
        {otherSelected && (
          <form
            className="flex items-center gap-2 pt-1"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(answerText.trim());
            }}
          >
            <Input
              className="h-8 bg-white text-sm"
              value={answerText}
              aria-label={t("courseAuthoring.activityRail.yourAnswer")}
              placeholder={t("courseAuthoring.activityRail.yourAnswer")}
              disabled={submitting || !onAnswer}
              onChange={(event) => setAnswerText(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !answerText.trim() || !onAnswer}
            >
              {t("courseAuthoring.conversation.answer")}
            </Button>
          </form>
        )}
      </div>
    );
  } else {
    responseNode = (
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(answerText.trim());
        }}
      >
        <Input
          className="h-8 bg-white text-sm"
          value={answerText}
          aria-label={t("courseAuthoring.activityRail.yourAnswer")}
          placeholder={t("courseAuthoring.activityRail.yourAnswer")}
          disabled={submitting || !onAnswer}
          onChange={(event) => setAnswerText(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={submitting || !answerText.trim() || !onAnswer}>
          {t("courseAuthoring.conversation.answer")}
        </Button>
        {otherSelected && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOtherSelected(false)}>
            {t("courseAuthoring.conversation.questionSuggestions")}
          </Button>
        )}
      </form>
    );
  }

  const prompt = capability ? t("courseAuthoring.conversation.webSearchPrompt") : question.prompt;

  if (capability) {
    return (
      <div
        className="flex max-w-xl flex-wrap items-center gap-x-2 gap-y-1 text-sm"
        data-testid={`course-authoring-question-${question.id}`}
      >
        <span className="font-medium text-neutral-800">{prompt}</span>
        {responseNode}
      </div>
    );
  }

  return (
    <div
      className="max-w-xl rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm"
      data-testid={`course-authoring-question-${question.id}`}
    >
      {!hidePrompt && <p className="font-medium text-neutral-800">{prompt}</p>}
      {responseNode}
    </div>
  );
};

const authoringQuestionKey = (question: QuestionView) =>
  `assistant-question-${question.taskId}-${question.revision}`;

const AuthoringPlanSteps = ({ planId, steps }: { planId: string; steps: string[] }) => {
  const { t } = useTranslation();
  return (
    <AuthoringCollapsibleSection
      title={t("courseAuthoring.activityRail.plan")}
      summary={t("courseAuthoring.activityRail.planStepCount", { count: steps.length })}
      testId={`course-authoring-plan-${planId}`}
    >
      <ol className="space-y-1 py-1">
        {steps.map((step, index) => (
          <li
            key={`${index}-${step}`}
            className="flex items-start gap-3 text-sm leading-5 text-neutral-800"
          >
            <span className="w-4 shrink-0 text-right tabular-nums text-neutral-500">
              {index + 1}.
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </AuthoringCollapsibleSection>
  );
};

const authoringMarkdownComponents = {
  ...variants,
  a: AuthoringMarkdownLink,
} as Components;

/** Indents follow-up assistant content under the previous avatar instead of repeating it. */
const AssistantContinuation = ({
  children,
  testId,
  contentTestId,
}: {
  children: ReactNode;
  testId?: string;
  contentTestId?: string;
}) => (
  <div className="flex max-w-full gap-3" data-testid={testId}>
    <div className="w-10 shrink-0" aria-hidden="true" />
    <div
      className="min-w-0 max-w-[90%] break-words text-sm leading-relaxed text-gray-800"
      data-testid={contentTestId}
    >
      {children}
    </div>
  </div>
);

const AssistantChatMessage = ({
  message,
  aiName,
  requestId,
  taskLabels,
  proposalById,
  questions,
  onAnswerQuestion,
  testIdSuffix,
  continuation = false,
}: {
  message: AuthoringChatMessage;
  aiName: string;
  requestId: string;
  taskLabels: Record<string, string>;
  proposalById?: Record<string, ReactNode>;
  questions: QuestionView[];
  onAnswerQuestion?: (question: QuestionView, answer: string) => Promise<void>;
  testIdSuffix?: string;
  continuation?: boolean;
}) => {
  const renderedQuestionIds = new Set<string>();
  const repeatedQuestionTextIds = new Set<string>();
  const repeatedQuestionIds = new Set<string>();
  const latestTextByTask = new Map<string, PartMarker>();
  message.parts.forEach((part) => {
    if (isPartMarker(part) && part.data.partKind === "text" && part.data.taskId) {
      latestTextByTask.set(part.data.taskId, part);
    }
  });
  message.parts.forEach((part) => {
    if (
      !isPartMarker(part) ||
      part.data.partKind !== "question" ||
      part.data.artifact?.artifactKind !== "question"
    ) {
      return;
    }
    const question = questions.find((entry) => entry.id === part.data.artifact?.artifactId);
    const precedingText = question?.taskId ? latestTextByTask.get(question.taskId) : undefined;
    if (question && precedingText?.data.text?.trim() === question.prompt.trim()) {
      repeatedQuestionIds.add(question.id);
      repeatedQuestionTextIds.add(precedingText.data.partId);
    }
  });

  const baseTestId = `course-authoring-assistant-${requestId}${testIdSuffix ?? ""}`;
  const baseContentTestId = `course-authoring-assistant-content-${requestId}${testIdSuffix ?? ""}`;
  const contentNode = (
    <div className="space-y-2">
      {message.parts.map((part, index) => {
        if (!isPartMarker(part)) return null;
        let partNode: ReactNode = null;
        if (part.data.partKind === "text" && part.data.text) {
          const isActiveProgress =
            (part.data.status === "streaming" || part.data.status === "started") &&
            !repeatedQuestionTextIds.has(part.data.partId);
          const isFailedProgress = part.data.status === "failed";
          const { text, sources } =
            isActiveProgress || isFailedProgress
              ? { text: part.data.text, sources: [] }
              : extractTrailingSources(compactLinkSeparators(part.data.text));
          partNode = (
            <div
              className={
                isActiveProgress || isFailedProgress
                  ? "text-sm text-muted-foreground"
                  : "text-foreground"
              }
              data-testid={isActiveProgress ? "authoring-progress-part" : undefined}
            >
              <div className={isActiveProgress ? "loading-text-shimmer" : undefined}>
                <Markdown
                  components={authoringMarkdownComponents}
                  remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {text}
                </Markdown>
              </div>
              <AuthoringSourceChipRow sources={sources} />
            </div>
          );
        }
        if (part.data.partKind === "tool" && part.data.tool) {
          partNode = (
            <AuthoringToolActivity
              tool={part.data.tool}
              taskLabel={part.data.taskId ? taskLabels[part.data.taskId] : undefined}
            />
          );
        }
        if (part.data.partKind === "proposal" && part.data.artifact?.artifactKind === "proposal") {
          const proposal = proposalById?.[part.data.artifact.artifactId];
          if (proposal) partNode = <div>{proposal}</div>;
        }
        if (part.data.partKind === "question" && part.data.artifact?.artifactKind === "question") {
          const question = questions.find((entry) => entry.id === part.data.artifact?.artifactId);
          if (question && !renderedQuestionIds.has(question.id)) {
            renderedQuestionIds.add(question.id);
            partNode = (
              <AuthoringQuestionCard
                question={question}
                onAnswer={onAnswerQuestion}
                hidePrompt={repeatedQuestionIds.has(question.id)}
                key={authoringQuestionKey(question)}
              />
            );
          }
        }
        return partNode && <Fragment key={`assistant-part-${index}`}>{partNode}</Fragment>;
      })}
    </div>
  );

  if (continuation) {
    return (
      <AssistantContinuation testId={baseTestId} contentTestId={baseContentTestId}>
        {contentNode}
      </AssistantContinuation>
    );
  }

  return (
    <ChatMessage
      id={`${message.id}${testIdSuffix ?? ""}`}
      role={"assistant" as const}
      content=""
      contentNode={contentNode}
      aiName={aiName}
      testId={baseTestId}
      contentTestId={baseContentTestId}
    />
  );
};

const CHAT_ERROR_KIND = {
  UNAVAILABLE: "unavailable",
  NETWORK: "network",
  GENERIC: "generic",
} as const;

const chatErrorKind = (error: Error) => {
  const status =
    (error as { status?: number; response?: { status?: number } }).response?.status ??
    (error as { status?: number }).status ??
    Number(/status code (\d{3})/i.exec(error.message)?.[1]);
  if (status >= 500) return CHAT_ERROR_KIND.UNAVAILABLE;
  if (/network|failed to fetch|timeout/i.test(error.message)) return CHAT_ERROR_KIND.NETWORK;
  return CHAT_ERROR_KIND.GENERIC;
};

const ChatErrorNotice = ({ error, onRetry }: { error: Error; onRetry?: () => void }) => {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      title={error.message}
      className="ml-[52px] flex max-w-xl items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm"
      data-testid="course-authoring-chat-error"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600">
        <CircleAlert className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">
          {t("courseAuthoring.conversation.requestFailedTitle")}
        </p>
        <p className="text-xs text-neutral-500">
          {t(`courseAuthoring.conversation.requestFailed.${chatErrorKind(error)}`)}
        </p>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-primary-700 hover:bg-primary-50"
          onClick={onRetry}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t("courseAuthoring.conversation.retry")}
        </Button>
      )}
    </div>
  );
};

export const AuthoringAssistantMessages = ({
  chatMessages,
  pendingTasks = [],
  taskActivities = [],
  taskLabels = {},
  plans = [],
  proposalById = {},
  proposalGroups = [],
  previews = [],
  sources = [],
  onPreviewInCurriculum,
  questionsByRequest = {},
  onAnswerQuestion,
  chatError,
  onRetryChat,
}: Props) => {
  const { t } = useTranslation();
  const [pendingQuestionIndex, setPendingQuestionIndex] = useState(0);
  const pendingQuestions = Object.values(questionsByRequest)
    .flat()
    .filter((question) => !question.answered && typeof question.answer !== "string");
  const activePendingIndex = Math.min(
    pendingQuestionIndex,
    Math.max(0, pendingQuestions.length - 1),
  );
  const activePendingQuestion = pendingQuestions[activePendingIndex];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const renderedAttachmentSourceIds = new Set<string>();
  const requestAttachmentChips = (message: AuthoringChatMessage) => {
    const sourceIds = message.metadata?.sourceVersionIds ?? [];
    const attachedSources = sourceIds.flatMap((sourceId) => {
      if (renderedAttachmentSourceIds.has(sourceId)) return [];
      renderedAttachmentSourceIds.add(sourceId);
      const source = sourceById.get(sourceId);
      return source ? [source] : [];
    });
    if (attachedSources.length === 0) return null;
    return (
      <div
        className="flex flex-wrap justify-end gap-2"
        data-testid="course-authoring-message-attachments"
      >
        {attachedSources.map((source) => (
          <span
            key={source.id}
            className="inline-flex max-w-sm items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-left text-xs text-foreground shadow-sm"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
              <FileText className="size-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block max-w-52 truncate font-medium" title={source.name}>
                {source.name}
              </span>
            </span>
          </span>
        ))}
      </div>
    );
  };

  const activeToolTaskIds = new Set(
    chatMessages.flatMap((message) =>
      message.role === "assistant"
        ? message.parts.flatMap((part) =>
            isPartMarker(part) &&
            part.data.partKind === "tool" &&
            part.data.tool?.status === "started" &&
            part.data.taskId
              ? [part.data.taskId]
              : [],
          )
        : [],
    ),
  );
  const timelineDecorations: AuthoringTimelineDecoration<ReactNode>[] = [
    ...plans
      .filter((plan) => plan.planSteps.length > 0)
      .map((plan) => ({
        id: `plan-${plan.id}`,
        requestId: plan.requestId,
        kind: "plan" as const,
        taskId: plan.taskId,
        partId: plan.partId,
        sequence: plan.firstSequence,
        value: <AuthoringPlanSteps planId={plan.id} steps={plan.planSteps.slice(0, 6)} />,
      })),
    ...Object.entries(questionsByRequest).flatMap(([requestId, questions]) =>
      questions
        .filter((question) => question.answered || typeof question.answer === "string")
        .map((question) => ({
          id: `question-${question.id}-${question.revision}`,
          requestId,
          kind: "question" as const,
          taskId: question.taskId,
          artifactIds: [question.id],
          value: (
            <AuthoringQuestionCard
              question={question}
              onAnswer={onAnswerQuestion}
              key={authoringQuestionKey(question)}
            />
          ),
        })),
    ),
    ...previews.map((preview) => ({
      id: `preview-${preview.taskId}`,
      requestId: preview.requestId,
      kind: "preview" as const,
      taskId: preview.taskId,
      value: (
        <AuthoringLivePreview
          preview={preview}
          onPreviewInCurriculum={
            onPreviewInCurriculum ? () => onPreviewInCurriculum(preview) : undefined
          }
        />
      ),
    })),
    ...taskActivities.map((activity) => ({
      id: `activity-${activity.taskId}`,
      requestId: activity.requestId,
      kind: "activity" as const,
      taskId: activity.taskId,
      sequence: activity.sequence,
      value: activity.content,
    })),
    ...proposalGroups.map((group) => ({
      id: `proposal-group-${group.taskId}`,
      requestId: group.requestId,
      kind: "proposalGroup" as const,
      taskId: group.taskId,
      artifactIds: group.proposalIds,
      value: group.content,
    })),
    ...pendingTasks
      .filter((task) => !activeToolTaskIds.has(task.taskId))
      .map((task) => ({
        id: `pending-${task.taskId}`,
        requestId: task.requestId,
        kind: "pending" as const,
        taskId: task.taskId,
        value: (
          <div className="flex items-center gap-2 text-xs text-neutral-600" role="status">
            <TypingDots className="gap-1 rounded-none bg-transparent p-0" dotClassName="size-1" />
            <span className="loading-text-shimmer">
              {task.phaseLabel ?? t("courseAuthoring.conversation.working")}
            </span>
          </div>
        ),
      })),
  ];
  const timeline = projectAuthoringTimeline(chatMessages, timelineDecorations);
  if (timeline.length === 0 && pendingQuestions.length === 0 && !chatError) return null;

  const aiName = t("courseAuthoring.conversation.assistant");
  const groupedToolRequestIds = new Set(
    taskActivities
      .filter((activity) => activity.toolsIncluded)
      .map((activity) => activity.requestId),
  );
  let lastRenderedRole: "user" | "assistant" | null = null;
  const assistantBlockCountByRequest = new Map<string, number>();
  const renderAssistantBlock = (key: string, content: ReactNode) => {
    const continuation = lastRenderedRole === "assistant";
    lastRenderedRole = "assistant";
    if (continuation) return <AssistantContinuation key={key}>{content}</AssistantContinuation>;
    return (
      <ChatMessage
        key={key}
        id={key}
        role={"assistant" as const}
        aiName={aiName}
        contentNode={content}
      />
    );
  };
  const hasVisiblePart = (part: ChatPart, requestId: string) => {
    if (!isPartMarker(part)) return false;
    if (part.data.partKind === "text") return Boolean(part.data.text?.trim());
    if (part.data.partKind === "tool")
      return part.data.tool !== null && !groupedToolRequestIds.has(requestId);
    if (part.data.partKind === "question") {
      return (
        part.data.artifact?.artifactKind === "question" &&
        (questionsByRequest[requestId] ?? []).some(
          (question) =>
            question.id === part.data.artifact?.artifactId &&
            (question.answered || typeof question.answer === "string"),
        )
      );
    }
    return (
      part.data.artifact?.artifactKind === "proposal" &&
      Boolean(proposalById[part.data.artifact.artifactId])
    );
  };
  const nextAssistantSuffix = (requestId: string) => {
    const count = assistantBlockCountByRequest.get(requestId) ?? 0;
    assistantBlockCountByRequest.set(requestId, count + 1);
    return count === 0 ? undefined : `-continuation-${count + 1}`;
  };

  const sections: Array<{ requestId: string; items: typeof timeline }> = [];
  timeline.forEach((item) => {
    const lastSection = sections.at(-1);
    if (lastSection?.requestId === item.requestId) {
      lastSection.items.push(item);
    } else {
      sections.push({ requestId: item.requestId, items: [item] });
    }
  });

  const renderSection = (items: typeof timeline): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let index = 0;
    while (index < items.length) {
      const item = items[index];
      if (item.kind === "request") {
        lastRenderedRole = "user";
        nodes.push(
          <ChatMessage
            key={item.id}
            id={item.id}
            role={"user" as const}
            contentNodeOwnsSurface
            contentNode={
              <div className="flex flex-col items-end gap-2">
                <div className="w-fit max-w-full rounded-xl bg-primary-100 px-4 py-2 text-sm leading-relaxed text-foreground">
                  {getUiMessageText(item.message)}
                </div>
                {requestAttachmentChips(item.message)}
              </div>
            }
            userName={t("courseAuthoring.conversation.you")}
            testId={`course-authoring-request-${item.requestId}`}
            contentTestId={`course-authoring-request-content-${item.requestId}`}
          />,
        );
        index += 1;
        continue;
      }

      if (item.kind === "part") {
        const chunk = [item];
        let nextIndex = index + 1;
        while (nextIndex < items.length) {
          const next = items[nextIndex];
          if (next.kind !== "part" || next.requestId !== item.requestId) {
            break;
          }
          chunk.push(next);
          nextIndex += 1;
        }
        const visibleParts = chunk
          .map((entry) => entry.part)
          .filter((part) => hasVisiblePart(part, item.requestId));
        if (visibleParts.length > 0) {
          const suffix = nextAssistantSuffix(item.requestId);
          nodes.push(
            <AssistantChatMessage
              key={`${item.message.id}-${item.id}`}
              message={{ ...item.message, parts: visibleParts }}
              aiName={aiName}
              taskLabels={taskLabels}
              continuation={lastRenderedRole === "assistant"}
              requestId={item.requestId}
              proposalById={proposalById}
              questions={questionsByRequest[item.requestId] ?? []}
              onAnswerQuestion={onAnswerQuestion}
              testIdSuffix={suffix}
            />,
          );
          lastRenderedRole = "assistant";
        }
        index = nextIndex;
        continue;
      }

      nodes.push(renderAssistantBlock(item.id, item.value));
      index += 1;
    }
    return nodes;
  };

  return (
    <div className="space-y-4 pt-4" data-testid="course-authoring-assistant-messages">
      {sections.map((section, index) => (
        <section
          key={`${section.requestId}-${index}`}
          className="space-y-3"
          data-request-id={section.requestId}
        >
          {renderSection(section.items)}
        </section>
      ))}
      {activePendingQuestion && (
        <ChatMessage
          id={`pending-question-${activePendingQuestion.taskId}-${activePendingQuestion.revision}`}
          role={"assistant" as const}
          aiName={aiName}
          contentNode={
            <div className="max-w-xl space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>
                  {t("courseAuthoring.conversation.questionProgress", {
                    current: activePendingIndex + 1,
                    total: pendingQuestions.length,
                  })}
                </span>
                {pendingQuestions.length > 1 && (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={activePendingIndex === 0}
                      onClick={() => setPendingQuestionIndex(activePendingIndex - 1)}
                    >
                      {t("courseAuthoring.conversation.questionPrevious")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={activePendingIndex === pendingQuestions.length - 1}
                      onClick={() => setPendingQuestionIndex(activePendingIndex + 1)}
                    >
                      {t("courseAuthoring.conversation.questionNext")}
                    </Button>
                  </div>
                )}
              </div>
              <AuthoringQuestionCard
                key={`${activePendingQuestion.taskId}-${activePendingQuestion.revision}`}
                question={activePendingQuestion}
                onAnswer={onAnswerQuestion}
              />
            </div>
          }
        />
      )}
      {chatError && <ChatErrorNotice error={chatError} onRetry={onRetryChat} />}
    </div>
  );
};
