/** Renders task progress, asset decisions and connection state for the workspace. */
import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Globe,
  LoaderCircle,
  RotateCcw,
  Search,
  Square,
  Wrench,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import { parseFetchedResearchSources } from "../authoringSources";
import {
  authoringTaskFailureLabel,
  authoringTaskRetryLabel,
  canRetryAuthoringTask,
} from "../authoringTaskFailure";
import {
  AUTHORING_CONNECTION_STATE,
  AUTHORING_OUTLINE_PHASE,
  AUTHORING_APPLICATION_STATUS,
  AUTHORING_CHAPTER_PROGRESS_STATUS,
  AUTHORING_TASK_KIND,
  AUTHORING_TASK_STATUS,
  AUTHORING_TOOL_STATUS,
  AUTHORING_WORK_PROGRESS_STAGE,
} from "../courseAuthoring.constants";

import { AuthoringAssetDecision } from "./AuthoringAssetDecision";
import { AuthoringCollapsibleSection } from "./AuthoringCollapsibleSection";
import { AuthoringElapsedTime } from "./AuthoringElapsedTime";
import { AuthoringPlanStepList } from "./AuthoringPlanStepList";
import { AuthoringSourceChip } from "./AuthoringSourceCitation";
import { AuthoringWorkProgressBar } from "./AuthoringWorkProgressBar";

import type {
  ApplicationView,
  AssetTaskView,
  AuthoringConnectionState,
  AuthoringTask,
  AuthoringTurnPart,
  QuestionView,
} from "../courseAuthoring.types";

type ToolActivity = {
  tool: NonNullable<AuthoringTurnPart["tool"]>;
  taskId?: string;
  taskLabel?: string;
  sequence: number;
};

type Props = {
  compact?: boolean;
  tasks: AuthoringTask[];
  tools?: ToolActivity[];
  taskSequences?: Record<string, number>;
  taskLabels?: Record<string, string>;
  planSteps?: string[];
  questions: QuestionView[];
  assetTasks: AssetTaskView[];
  applications: ApplicationView[];
  connection: AuthoringConnectionState;
  busy?: boolean;
  onRetry: (taskId: string) => void;
  onStopRequest: (requestId: string) => void;
  onDiscardRequest?: (requestId: string) => void;
  onAnswer: (question: QuestionView, answer: string) => void;
  onAssetAction: (asset: AssetTaskView, action: "asset.retry_submission") => void;
  onSkipAsset: (assetId: string) => void;
  onRestoreAsset?: (assetId: string) => void;
  omittedOptionalAssetIds?: string[];
};

type TaskWorkItem = {
  kind: "task";
  task: AuthoringTask;
  sequence: number;
  index: number;
};

type ToolWorkItem = {
  kind: "tool";
  tool: ToolActivity;
  sequence: number;
  index: number;
};

type ResearchWorkItem = {
  kind: "research";
  key: string;
  tools: ToolWorkItem[];
  sequence: number;
  index: number;
};

type WorkItem = TaskWorkItem | ToolWorkItem;

type ChapterWorkItem = {
  kind: "chapter";
  key: string;
  requestId: string;
  chapterId: string;
  chapterTitle: string;
  tasks: TaskWorkItem[];
  tools: ToolWorkItem[];
  sequence: number;
  index: number;
  lessonCount: number;
};

type CompactWorkItem = WorkItem | ChapterWorkItem | ResearchWorkItem;

const canStopTask = (task: AuthoringTask) =>
  [
    AUTHORING_TASK_STATUS.QUEUED,
    AUTHORING_TASK_STATUS.RUNNING,
    AUTHORING_TASK_STATUS.WAITING_AUTHOR,
    AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES,
    AUTHORING_TASK_STATUS.PAUSED,
  ].some((value) => value === task.status);

/** Groups only real lesson tasks with chapter context from durable progress metadata. */
const groupLessonWorkByChapter = (items: WorkItem[]): CompactWorkItem[] => {
  const candidatesByChapter = new Map<string, TaskWorkItem[]>();
  items.forEach((item) => {
    if (
      item.kind !== "task" ||
      item.task.kind !== AUTHORING_TASK_KIND.LESSON ||
      !item.task.workProgress?.chapterId ||
      !item.task.workProgress.chapterTitle
    ) {
      return;
    }

    const key = `${item.task.requestId}:${item.task.workProgress.chapterId}`;
    candidatesByChapter.set(key, [...(candidatesByChapter.get(key) ?? []), item]);
  });

  const groupedByTaskId = new Map<string, ChapterWorkItem>();
  const groupedByToolCallId = new Map<string, ChapterWorkItem>();
  candidatesByChapter.forEach((chapterTasks, key) => {
    if (chapterTasks.length < 2) return;
    const requestId = chapterTasks[0].task.requestId;
    const chapterId = chapterTasks[0].task.workProgress?.chapterId ?? "";
    const progress = items.find(
      (item): item is TaskWorkItem =>
        item.kind === "task" &&
        item.task.requestId === requestId &&
        Boolean(
          item.task.workProgress?.chapters?.some((chapter) => chapter.chapterId === chapterId),
        ),
    )?.task.workProgress;
    const currentChapter = progress?.chapters?.find((chapter) => chapter.chapterId === chapterId);
    const first = chapterTasks.reduce((earliest, item) =>
      item.sequence < earliest.sequence ||
      (item.sequence === earliest.sequence && item.index < earliest.index)
        ? item
        : earliest,
    );
    const chapterTaskIds = new Set(chapterTasks.map((item) => item.task.taskId));
    const chapterTools = items.filter(
      (item): item is ToolWorkItem =>
        item.kind === "tool" &&
        typeof item.tool.taskId === "string" &&
        chapterTaskIds.has(item.tool.taskId),
    );
    const firstItem = [...chapterTasks, ...chapterTools].reduce((earliest, item) =>
      item.sequence < earliest.sequence ||
      (item.sequence === earliest.sequence && item.index < earliest.index)
        ? item
        : earliest,
    );
    const group: ChapterWorkItem = {
      kind: "chapter",
      key,
      requestId: first.task.requestId,
      chapterId,
      chapterTitle: currentChapter?.title ?? first.task.workProgress?.chapterTitle ?? "",
      tasks: chapterTasks,
      tools: chapterTools,
      sequence: firstItem.sequence,
      index: firstItem.index,
      lessonCount: currentChapter?.lessonCount ?? chapterTasks.length,
    };
    chapterTasks.forEach((item) => groupedByTaskId.set(item.task.taskId, group));
    chapterTools.forEach((item) => groupedByToolCallId.set(item.tool.tool.toolCallId, group));
  });

  const emittedGroups = new Set<string>();
  return items.flatMap<CompactWorkItem>((item): CompactWorkItem[] => {
    let group: ChapterWorkItem | undefined;
    if (item.kind === "task") group = groupedByTaskId.get(item.task.taskId);
    else if (item.kind === "tool") group = groupedByToolCallId.get(item.tool.tool.toolCallId);
    if (!group) return [item];
    if (emittedGroups.has(group.key)) return [];
    emittedGroups.add(group.key);
    return [group];
  });
};

/** Maps task state to the shared status badge variant. */
const statusVariant = (status: AuthoringTask["status"]) => {
  if (status === AUTHORING_TASK_STATUS.SUCCEEDED) return "success" as const;
  if (
    [
      AUTHORING_TASK_STATUS.FAILED,
      AUTHORING_TASK_STATUS.STOPPED,
      AUTHORING_TASK_STATUS.SUPERSEDED,
    ].some((value) => value === status)
  )
    return "blocked" as const;
  return "inProgress" as const;
};

/** Maps task state to its localized activity label key. */
const taskStatusKey = (status: AuthoringTask["status"]) =>
  match(status)
    .with(AUTHORING_TASK_STATUS.SUCCEEDED, () => "complete")
    .with(AUTHORING_TASK_STATUS.WAITING_AUTHOR, () => "waitingAuthor")
    .with(AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES, () => "waitingDependencies")
    .otherwise((value) => value);

/** Prefers the task kind: the phase can lag behind or describe a sibling step. */
const taskKindKey = (task: AuthoringTask) => {
  if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.REPAIRING) {
    return task.kind === AUTHORING_TASK_KIND.LESSON ? "revisingLesson" : "revisingLessonPlan";
  }
  if (
    task.kind === AUTHORING_TASK_KIND.COURSE_REVIEW ||
    task.phase === AUTHORING_OUTLINE_PHASE.REVIEWING
  )
    return "checkingCourse";
  if (task.phase === "researching" || task.phase === "source_working") return "searchingSources";
  if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.VALIDATION) {
    return task.kind === AUTHORING_TASK_KIND.LESSON ? "checkingLesson" : "checkingLessonPlan";
  }
  if (
    task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.OUTLINE ||
    task.kind === AUTHORING_TASK_KIND.PLAN
  )
    return "planningOutline";
  if (
    task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.LESSON_PLANNING ||
    task.kind === AUTHORING_TASK_KIND.DETAILED_PLAN
  ) {
    return "planningLessons";
  }
  if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.LESSON_GENERATION)
    return "generatingLesson";
  const kindOrPhase = task.kind ?? task.phase;
  if (!task.kind && task.phase === "preparing") return "preparingResponse";
  if (["route", "route_working"].includes(kindOrPhase ?? "")) return "understandingRequest";

  if (
    [
      "research",
      "researching",
      "source",
      "source_refresh",
      "source_selection",
      "source_working",
    ].includes(kindOrPhase ?? "")
  ) {
    return "searchingSources";
  }
  if (["plan", "detailed_plan", "planning"].includes(kindOrPhase ?? "")) return "planningCourse";
  if (["lesson", "generating_lesson", "writing"].includes(kindOrPhase ?? "")) {
    return "generatingLesson";
  }
  if (["edit", "updating_course", "editing"].includes(kindOrPhase ?? "")) return "updatingCourse";
  if (["asset", "asset_working"].includes(kindOrPhase ?? "")) return "creatingVisual";
  return "working";
};

const taskKindLabel = (task: AuthoringTask, t: (key: string) => string) =>
  match(taskKindKey(task))
    .with("checkingCourse", () => t("courseAuthoring.conversation.checkingCourse"))
    .with("checkingLesson", () => t("courseAuthoring.activityRail.taskKind.checkingLesson"))
    .with("checkingLessonPlan", () => t("courseAuthoring.activityRail.taskKind.checkingLessonPlan"))
    .with("searchingSources", () => t("courseAuthoring.activityRail.taskKind.searchingSources"))
    .with("planningOutline", () => t("courseAuthoring.conversation.planningOutline"))
    .with("planningLessons", () => t("courseAuthoring.conversation.planningLessons"))
    .with("planningCourse", () => t("courseAuthoring.activityRail.taskKind.planningCourse"))
    .with("generatingLesson", () => t("courseAuthoring.activityRail.taskKind.generatingLesson"))
    .with("revisingLesson", () => t("courseAuthoring.activityRail.taskKind.revisingLesson"))
    .with("revisingLessonPlan", () => t("courseAuthoring.activityRail.taskKind.revisingLessonPlan"))
    .with("updatingCourse", () => t("courseAuthoring.activityRail.taskKind.updatingCourse"))
    .with("understandingRequest", () => t("courseAuthoring.conversation.understandingRequest"))
    .with("preparingResponse", () => t("courseAuthoring.conversation.preparingResponse"))
    .with("creatingVisual", () => t("courseAuthoring.conversation.creatingVisual"))
    .otherwise(() => t("courseAuthoring.activityRail.taskKind.working"));

const taskFailureLabel = (task: AuthoringTask, t: (key: string) => string) =>
  t(`courseAuthoring.activityRail.${authoringTaskFailureLabel(task)}`);

/** Maps task state to the activity icon used by the rail. */
const taskStatusIcon = (status: AuthoringTask["status"]) =>
  match(status)
    .with(AUTHORING_TASK_STATUS.SUCCEEDED, () => (
      <CheckCircle2 className="size-3.5 text-success-700" />
    ))
    .with(AUTHORING_TASK_STATUS.FAILED, () => <AlertCircle className="size-3.5 text-destructive" />)
    .with(AUTHORING_TASK_STATUS.RUNNING, () => (
      <LoaderCircle className="size-3.5 text-primary-700 motion-safe:animate-spin" />
    ))
    .otherwise(() => <Clock3 className="size-3.5 text-neutral-400" />);

/** Running, queued and finished states are already conveyed by the row icon. */
const SELF_EVIDENT_TASK_STATUSES = new Set<AuthoringTask["status"]>([
  AUTHORING_TASK_STATUS.RUNNING,
  AUTHORING_TASK_STATUS.QUEUED,
  AUTHORING_TASK_STATUS.SUCCEEDED,
]);

const WEB_TOOL_NAMES = new Set(["web_search", "research"]);
/** Matches "6/11" with an optional " · current topic" suffix. */
const SYNTHESIS_PROGRESS_PATTERN = /^\s*(\d+)\s*\/\s*(\d+)(?:\s*·\s*(.+))?$/;
const MAX_VISIBLE_SEARCH_QUERIES = 12;
const MAX_VISIBLE_SOURCES = 4;

const isWebTool = (tool: ToolActivity["tool"]) => WEB_TOOL_NAMES.has(tool.toolName);

const searchQueriesForTools = (tools: ToolActivity[]) => {
  const queries: string[] = [];
  const seen = new Set<string>();
  tools.forEach(({ tool }) => {
    const resultQueries = [tool.result?.query, ...(tool.result?.queries ?? [])];
    resultQueries.forEach((query) => {
      if (typeof query !== "string" || query.trim().length === 0 || seen.has(query)) return;
      seen.add(query);
      queries.push(query);
    });
  });
  return queries;
};

/** Groups query-level web calls while keeping their exact query text in the activity rail. */
const groupResearchActivity = (items: CompactWorkItem[]): CompactWorkItem[] => {
  const groups = new Map<string, ResearchWorkItem>();
  return items.flatMap((item): CompactWorkItem[] => {
    if (item.kind !== "tool" || !isWebTool(item.tool.tool)) return [item];
    const key = item.tool.taskId ? `task:${item.tool.taskId}` : "request";
    const group = groups.get(key);
    if (group) {
      group.tools.push(item);
      return [];
    }
    const newGroup: ResearchWorkItem = {
      kind: "research",
      key,
      tools: [item],
      sequence: item.sequence,
      index: item.index,
    };
    groups.set(key, newGroup);
    return [newGroup];
  });
};

const ROW_CLASS = "flex min-h-7 items-center gap-2 px-1 text-[13px] leading-5";
const ROW_DETAIL_CLASS = "ml-[26px]";

const AuthoringSearchQuery = ({ query }: { query: string }) => (
  <li className="flex min-w-0 items-start gap-1.5 text-xs leading-5 text-neutral-500">
    <Search className="mt-1 size-3 shrink-0 text-neutral-400" aria-hidden="true" />
    <span className="min-w-0 break-words">{query}</span>
  </li>
);

const AuthoringSearchQueries = ({ queries }: { queries: string[] }) => {
  const { t } = useTranslation();
  const visibleQueries = queries.slice(0, MAX_VISIBLE_SEARCH_QUERIES);
  const omittedQueries = queries.slice(visibleQueries.length);
  return (
    <>
      {visibleQueries.length > 0 && (
        <ul
          aria-label={t("courseAuthoring.activityRail.searchQueries")}
          className={cn(ROW_DETAIL_CLASS, "space-y-0.5")}
        >
          {visibleQueries.map((query) => (
            <AuthoringSearchQuery key={query} query={query} />
          ))}
        </ul>
      )}
      {omittedQueries.length > 0 && (
        <details className={cn(ROW_DETAIL_CLASS, "text-xs text-neutral-500")}>
          <summary className="cursor-pointer py-0.5 hover:text-neutral-800">
            {t("courseAuthoring.activityRail.moreSearchQueries", { count: omittedQueries.length })}
          </summary>
          <ul className="space-y-0.5 pt-0.5">
            {omittedQueries.map((query) => (
              <AuthoringSearchQuery key={query} query={query} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
};

const AuthoringResearchSources = ({ tools }: { tools: ToolActivity[] }) => {
  const { t } = useTranslation();
  const sources = parseFetchedResearchSources(
    tools.flatMap(({ tool }) => tool.result?.sources ?? []),
  ).map(({ url, title }) => ({ url, label: title }));
  const [expanded, setExpanded] = useState(false);
  if (sources.length === 0) return null;
  const visibleSources = expanded ? sources : sources.slice(0, MAX_VISIBLE_SOURCES);
  const hiddenCount = sources.length - visibleSources.length;
  return (
    <ul
      className={cn(ROW_DETAIL_CLASS, "flex flex-wrap items-center gap-1 pt-1")}
      aria-label={t("courseAuthoring.sources.label")}
      data-testid="authoring-source-row"
    >
      {visibleSources.map((source) => (
        <li key={source.url}>
          <AuthoringSourceChip source={source} className="mx-0" />
        </li>
      ))}
      {hiddenCount > 0 && (
        <li>
          <button
            type="button"
            className="rounded-full px-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
            onClick={() => setExpanded(true)}
          >
            {t("courseAuthoring.changeSet.more", { count: hiddenCount })}
          </button>
        </li>
      )}
    </ul>
  );
};

/** Keeps failed search attempts visible without presenting them as verified citations. */
const AuthoringResearchDiagnostics = ({ tools }: { tools: ToolActivity[] }) => {
  const messages = Array.from(
    new Set(
      tools.flatMap(({ tool }) =>
        [AUTHORING_TOOL_STATUS.FAILED, AUTHORING_TOOL_STATUS.STOPPED].some(
          (value) => value === tool.status,
        ) &&
        tool.display.trim() &&
        tool.display !== tool.result?.query
          ? [tool.display]
          : [],
      ),
    ),
  );
  if (messages.length === 0) return null;
  return (
    <div className={cn(ROW_DETAIL_CLASS, "space-y-1 text-xs text-neutral-600")}>
      {messages.map((message) => (
        <p key={message} className="whitespace-pre-line break-words">
          {message}
        </p>
      ))}
    </div>
  );
};

const AuthoringResearchActivity = ({ tools }: { tools: ToolActivity[] }) => {
  const orderedTools = [...tools].sort((left, right) => left.sequence - right.sequence);
  const representative =
    orderedTools.find(({ tool }) => tool.status === AUTHORING_TOOL_STATUS.STARTED) ??
    orderedTools.find(
      ({ tool }) =>
        tool.status === AUTHORING_TOOL_STATUS.FAILED ||
        tool.status === AUTHORING_TOOL_STATUS.STOPPED,
    ) ??
    orderedTools[orderedTools.length - 1];
  if (!representative) return null;

  const queries = searchQueriesForTools(orderedTools);
  const taskLabel = orderedTools.find((item) => item.taskLabel)?.taskLabel;
  return (
    <div className="pb-1">
      <AuthoringToolActivity
        {...representative}
        taskLabel={taskLabel}
        showCounts={false}
        showQueries={false}
        showSources={false}
        showDiagnostics={false}
      />
      <AuthoringSearchQueries queries={queries} />
      <AuthoringResearchDiagnostics tools={orderedTools} />
      <AuthoringResearchSources tools={orderedTools} />
    </div>
  );
};

const toolActivityLabel = (
  tool: ToolActivity["tool"],
  status: ToolActivity["tool"]["status"],
  t: (key: string) => string,
) =>
  match(tool.toolName)
    .with("research_synthesis", () =>
      t(`courseAuthoring.conversation.researchSynthesisTool.${status}`),
    )
    .with("web_extract", () => t(`courseAuthoring.conversation.webExtractTool.${status}`))
    .when(
      (name) => WEB_TOOL_NAMES.has(name),
      () => t(`courseAuthoring.conversation.webSearchTool.${status}`),
    )
    .otherwise(() => tool.display);

export const AuthoringToolActivity = ({
  tool,
  taskLabel,
  showCounts = true,
  showQueries = true,
  showSources = true,
  showDiagnostics = true,
}: Pick<ToolActivity, "tool" | "taskLabel"> & {
  showCounts?: boolean;
  showQueries?: boolean;
  showSources?: boolean;
  showDiagnostics?: boolean;
}) => {
  const { t } = useTranslation();
  const isWebToolActivity = isWebTool(tool);
  const isExtraction = tool.toolName === "web_extract";
  const isSynthesis = tool.toolName === "research_synthesis";
  const synthesisMatch = isSynthesis ? SYNTHESIS_PROGRESS_PATTERN.exec(tool.display) : null;
  const assessedCount = Number(synthesisMatch?.[1]);
  const topicCount = Number(synthesisMatch?.[2]);
  const currentTopic = synthesisMatch?.[3]?.trim();
  const synthesisCount = synthesisMatch ? `${assessedCount}/${topicCount}` : tool.display;
  const incompletePersistedSynthesis =
    tool.status === AUTHORING_TOOL_STATUS.COMPLETED &&
    synthesisMatch !== null &&
    assessedCount < topicCount;
  const displayStatus = incompletePersistedSynthesis ? AUTHORING_TOOL_STATUS.STOPPED : tool.status;
  const synthesisProgress =
    synthesisMatch && topicCount > 0
      ? Math.min(100, Math.round((assessedCount / topicCount) * 100))
      : null;
  const isRunning = displayStatus === AUTHORING_TOOL_STATUS.STARTED;
  const isProblem =
    displayStatus === AUTHORING_TOOL_STATUS.FAILED ||
    displayStatus === AUTHORING_TOOL_STATUS.STOPPED;
  const label = toolActivityLabel(tool, displayStatus, t);
  const counts = [
    typeof tool.result?.sourceCount === "number"
      ? t("courseAuthoring.conversation.toolSourceCount", { count: tool.result.sourceCount })
      : null,
    typeof tool.result?.findingCount === "number"
      ? t("courseAuthoring.conversation.toolFindingCount", { count: tool.result.findingCount })
      : null,
  ].filter((value): value is string => Boolean(value));
  const ToolIcon = isWebToolActivity || isExtraction ? Globe : Wrench;

  let icon = <ToolIcon className="size-3.5 text-neutral-400" aria-hidden="true" />;
  if (isRunning) {
    icon = (
      <LoaderCircle
        className="size-3.5 text-primary-600 motion-safe:animate-spin"
        aria-hidden="true"
      />
    );
  } else if (isProblem) {
    icon = <CircleAlert className="size-3.5 text-warning-600" aria-hidden="true" />;
  } else if (displayStatus === AUTHORING_TOOL_STATUS.COMPLETED) {
    icon = <CheckCircle2 className="size-3.5 text-success-700" aria-hidden="true" />;
  }

  return (
    <div className="space-y-0.5">
      <div
        data-testid={`course-authoring-tool-${tool.toolCallId}`}
        role="status"
        title={isWebToolActivity && tool.display !== label ? tool.display : undefined}
        className={cn(ROW_CLASS, "text-neutral-600")}
      >
        {icon}
        <span
          className={cn(
            "min-w-0 shrink-0 truncate",
            isRunning && "loading-text-shimmer",
            isProblem && "text-neutral-800",
          )}
        >
          {isRunning ? label : label.replace(/(…|\.\.\.)$/, "")}
        </span>
        {taskLabel && <span className="min-w-0 truncate text-neutral-400">{taskLabel}</span>}
        {!isWebToolActivity && !isExtraction && !isSynthesis && isProblem && (
          <span className="ml-auto shrink-0 text-xs text-neutral-500">
            {t(`courseAuthoring.activityRail.taskStatus.${tool.status}`)}
          </span>
        )}
        {showCounts && counts.length > 0 && (
          <span className="ml-auto shrink-0 text-xs text-neutral-400">{counts.join(" · ")}</span>
        )}
      </div>
      {isSynthesis && tool.display && (
        <div className={cn(ROW_DETAIL_CLASS, "flex items-center gap-2")}>
          {synthesisProgress !== null && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={synthesisProgress}
              aria-label={t("courseAuthoring.conversation.researchSynthesisProgress", {
                progress: synthesisCount,
              })}
              className="h-1 w-40 shrink-0 overflow-hidden rounded-full bg-neutral-200"
            >
              <div
                className={cn(
                  "h-full rounded-full bg-primary-600 transition-[width,background-color] duration-500 motion-reduce:transition-none",
                  isRunning && "motion-safe:animate-pulse",
                  displayStatus === AUTHORING_TOOL_STATUS.COMPLETED && "bg-success-600",
                  isProblem && "bg-warning-500",
                )}
                style={{ width: `${synthesisProgress}%` }}
              />
            </div>
          )}
          <p
            className={cn(
              "shrink-0 text-xs tabular-nums text-neutral-500",
              displayStatus === AUTHORING_TOOL_STATUS.COMPLETED && "text-success-700",
            )}
          >
            {t("courseAuthoring.conversation.researchSynthesisProgress", {
              progress: synthesisCount,
            })}
          </p>
        </div>
      )}
      {isRunning && currentTopic && (
        <p
          className={cn(ROW_DETAIL_CLASS, "truncate text-xs text-neutral-500")}
          title={currentTopic}
        >
          {currentTopic}
        </p>
      )}
      {isExtraction && typeof tool.result?.query === "string" && (
        <p className={cn(ROW_DETAIL_CLASS, "break-all text-xs text-neutral-500")}>
          {tool.result.query}
        </p>
      )}
      {isWebToolActivity && showQueries && (
        <AuthoringSearchQueries queries={searchQueriesForTools([{ tool, sequence: 0 }])} />
      )}
      {(isWebToolActivity || isExtraction) && showSources && (
        <AuthoringResearchSources tools={[{ tool, sequence: 0 }]} />
      )}
      {(isWebToolActivity || isExtraction) && showDiagnostics && (
        <AuthoringResearchDiagnostics tools={[{ tool, sequence: 0 }]} />
      )}
    </div>
  );
};

/** Maps socket state to the shared connection badge variant. */
const connectionVariant = (connection: AuthoringConnectionState) =>
  match(connection)
    .with(AUTHORING_CONNECTION_STATE.LIVE, () => "success" as const)
    .with(AUTHORING_CONNECTION_STATE.OFFLINE, () => "blocked" as const)
    .otherwise(() => "inProgress" as const);

/** Renders durable task progress and human action inbox items. */
export const AuthoringActivityRail = ({
  compact = false,
  tasks,
  tools = [],
  taskSequences = {},
  taskLabels = {},
  planSteps = [],
  questions,
  assetTasks,
  applications,
  connection,
  busy,
  onRetry,
  onStopRequest,
  onDiscardRequest,
  onAnswer,
  onAssetAction,
  onSkipAsset,
  onRestoreAsset,
  omittedOptionalAssetIds = [],
}: Props) => {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const succeeded = tasks.filter((task) => task.status === AUTHORING_TASK_STATUS.SUCCEEDED).length;
  const lessonTasks = tasks.filter((task) => task.kind === AUTHORING_TASK_KIND.LESSON);
  const lessonProgress = lessonTasks.flatMap((task) =>
    task.workProgress &&
    [
      AUTHORING_WORK_PROGRESS_STAGE.LESSON_GENERATION,
      AUTHORING_WORK_PROGRESS_STAGE.VALIDATION,
      AUTHORING_WORK_PROGRESS_STAGE.REPAIRING,
    ].some((value) => value === task.workProgress?.stage)
      ? [task.workProgress]
      : [],
  );
  const completedLessons = Math.max(
    lessonTasks.filter((task) => task.status === AUTHORING_TASK_STATUS.SUCCEEDED).length,
    ...lessonProgress.flatMap((item) =>
      item.completedLessons === undefined ? [] : [item.completedLessons],
    ),
  );
  const totalLessons = Math.max(
    lessonTasks.length,
    ...lessonProgress.flatMap((item) =>
      item.totalLessons === undefined ? [] : [item.totalLessons],
    ),
  );
  const hasLessonWork = compact && lessonTasks.length > 0;
  const detailedPlanTask = tasks.find(
    (task) =>
      task.kind === AUTHORING_TASK_KIND.DETAILED_PLAN && task.workProgress?.chapters?.length,
  );
  const plannedChapters = detailedPlanTask?.workProgress?.chapters ?? [];
  const completedChapters =
    detailedPlanTask?.status === AUTHORING_TASK_STATUS.SUCCEEDED
      ? plannedChapters.length
      : plannedChapters.filter(
          (chapter) => chapter.status === AUTHORING_CHAPTER_PROGRESS_STATUS.COMPLETE,
        ).length;
  const hasOpenWork =
    tasks.some(
      (task) =>
        ![
          AUTHORING_TASK_STATUS.SUCCEEDED,
          AUTHORING_TASK_STATUS.SUPERSEDED,
          AUTHORING_TASK_STATUS.STOPPED,
        ].some((value) => value === task.status),
    ) ||
    tools.some(
      ({ tool }) =>
        tool.status === AUTHORING_TOOL_STATUS.STARTED ||
        tool.status === AUTHORING_TOOL_STATUS.FAILED,
    );
  const workItems: WorkItem[] = [
    ...tasks.map((task, index) => ({
      kind: "task" as const,
      task,
      sequence: taskSequences[task.taskId] ?? Number.MAX_SAFE_INTEGER,
      index,
    })),
    ...tools.map((tool, index) => ({
      kind: "tool" as const,
      tool,
      sequence: tool.sequence,
      index,
    })),
  ].sort((left, right) => left.sequence - right.sequence || left.index - right.index);
  const compactWorkItems = groupResearchActivity(groupLessonWorkByChapter(workItems));
  const hasFailedWork =
    tasks.some((task) => task.status === AUTHORING_TASK_STATUS.FAILED) ||
    tools.some(({ tool }) => tool.status === AUTHORING_TOOL_STATUS.FAILED);
  const hasRunningWork =
    tasks.some((task) =>
      [AUTHORING_TASK_STATUS.QUEUED, AUTHORING_TASK_STATUS.RUNNING].some(
        (value) => value === task.status,
      ),
    ) || tools.some(({ tool }) => tool.status === AUTHORING_TOOL_STATUS.STARTED);
  let liveWorkTone: "neutral" | "success" | "danger" = "neutral";
  if (hasFailedWork) liveWorkTone = "danger";
  else if (!hasOpenWork && tasks.length + tools.length > 0) liveWorkTone = "success";
  let liveWorkIcon = <CheckCircle2 className="size-3.5 text-success-700" />;
  if (hasFailedWork) liveWorkIcon = <AlertCircle className="size-3.5 text-destructive" />;
  else if (hasRunningWork) {
    liveWorkIcon = <LoaderCircle className="size-3.5 text-primary-700 motion-safe:animate-spin" />;
  } else if (hasOpenWork) liveWorkIcon = <Clock3 className="size-3.5 text-neutral-500" />;
  const connectionLabel = match(connection)
    .with(AUTHORING_CONNECTION_STATE.LIVE, () => t("courseAuthoring.activityRail.connection.live"))
    .with(AUTHORING_CONNECTION_STATE.OFFLINE, () =>
      t("courseAuthoring.activityRail.connection.offline"),
    )
    .with(AUTHORING_CONNECTION_STATE.RECOVERING, () =>
      t("courseAuthoring.activityRail.connection.recovering"),
    )
    .otherwise(() => t("courseAuthoring.activityRail.connection.connecting"));
  const questionGroups = Object.entries(
    questions.reduce<Record<string, QuestionView[]>>((groups, question) => {
      const requestId =
        tasks.find((task) => task.taskId === question.taskId)?.requestId ?? "unassigned";
      groups[requestId] = [...(groups[requestId] ?? []), question];
      return groups;
    }, {}),
  );
  let workSummary: string;
  if (hasLessonWork) {
    workSummary = t("courseAuthoring.activityRail.lessonsProgress", {
      completed: completedLessons,
      total: totalLessons,
    });
  } else if (detailedPlanTask) {
    workSummary = t("courseAuthoring.activityRail.chapterPlanningProgress", {
      completed: completedChapters,
      total: plannedChapters.length,
    });
  } else {
    workSummary = t("courseAuthoring.activityRail.stepsComplete", {
      completed:
        succeeded +
        tools.filter(({ tool }) => tool.status === AUTHORING_TOOL_STATUS.COMPLETED).length,
      total: tasks.length + tools.length,
    });
  }

  const taskLabelFor = (task: AuthoringTask) => {
    let label = taskLabels[task.taskId] ?? task.workProgress?.lessonTitle ?? taskKindLabel(task, t);
    if (task.kind === AUTHORING_TASK_KIND.DETAILED_PLAN && task.workProgress)
      label = taskKindLabel(task, t);
    if (task.workProgress?.stage === AUTHORING_WORK_PROGRESS_STAGE.RECOVERING) {
      label = t("courseAuthoring.activityRail.recoveringFailedParts");
    }
    return label;
  };
  const currentActivity = [
    ...tasks
      .filter((task) => task.status === AUTHORING_TASK_STATUS.RUNNING)
      .map((task) => ({
        sequence: taskSequences[task.taskId] ?? 0,
        label: taskLabelFor(task),
      })),
    ...tools
      .filter(({ tool }) => tool.status === AUTHORING_TOOL_STATUS.STARTED)
      .map(({ tool, sequence }) => ({
        sequence,
        label: toolActivityLabel(tool, tool.status, t),
      })),
  ]
    .sort((left, right) => left.sequence - right.sequence)
    .at(-1)?.label;
  const needsAttention =
    hasFailedWork || tasks.some((task) => task.status === AUTHORING_TASK_STATUS.WAITING_AUTHOR);

  const renderTask = (
    task: AuthoringTask,
    options: { showStop?: boolean; showChapterContext?: boolean } = {},
  ) => {
    let label = taskLabelFor(task);
    if (
      [
        AUTHORING_TASK_STATUS.SUCCEEDED,
        AUTHORING_TASK_STATUS.FAILED,
        AUTHORING_TASK_STATUS.STOPPED,
        AUTHORING_TASK_STATUS.SUPERSEDED,
      ].some((value) => value === task.status)
    )
      label = label.replace(/(…|\.\.\.)$/, "");
    const canStop = options.showStop !== false && canStopTask(task);
    const canDiscard = [
      AUTHORING_TASK_STATUS.WAITING_AUTHOR,
      AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES,
    ].some((value) => value === task.status);
    const requestAction = canDiscard && onDiscardRequest ? onDiscardRequest : onStopRequest;
    const requestActionLabel =
      canDiscard && onDiscardRequest
        ? t("courseAuthoring.activityRail.discardRequest")
        : t("courseAuthoring.activityRail.stopRequest");
    let chapterContext: string | null = null;
    if (task.workProgress?.chapterTitle) {
      if (
        task.workProgress.lessonTitle &&
        task.workProgress.stage === AUTHORING_WORK_PROGRESS_STAGE.LESSON_PLANNING
      ) {
        chapterContext = t("courseAuthoring.activityRail.chapterLessonContext", {
          chapter: task.workProgress.chapterTitle,
          lesson: task.workProgress.lessonTitle,
        });
      } else {
        chapterContext = t("courseAuthoring.activityRail.chapterContext", {
          chapter: task.workProgress.chapterTitle,
        });
      }
    }

    if (compact) {
      return (
        <div key={task.taskId} className="space-y-0.5">
          <div className={ROW_CLASS}>
            <span className="flex shrink-0">{taskStatusIcon(task.status)}</span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-neutral-700",
                task.status === AUTHORING_TASK_STATUS.RUNNING && "text-neutral-900",
              )}
              title={label}
            >
              {label}
            </span>
            {!SELF_EVIDENT_TASK_STATUSES.has(task.status) && (
              <span className="shrink-0 text-xs text-neutral-500">
                {t(`courseAuthoring.activityRail.taskStatus.${taskStatusKey(task.status)}`)}
              </span>
            )}
            {canStop && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                disabled={busy}
                onClick={() => requestAction(task.requestId)}
                aria-label={requestActionLabel}
                title={requestActionLabel}
              >
                <Square className="size-3 fill-current" />
              </Button>
            )}
            {canRetryAuthoringTask(task) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                disabled={busy}
                onClick={() => onRetry(task.taskId)}
                aria-label={t(`courseAuthoring.activityRail.${authoringTaskRetryLabel(task)}`)}
                title={t(`courseAuthoring.activityRail.${authoringTaskRetryLabel(task)}`)}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>
          {task.workProgress?.repairAttempt !== undefined &&
            task.workProgress.repairLimit !== undefined && (
              <p className={cn(ROW_DETAIL_CLASS, "text-xs text-neutral-500")}>
                {t("courseAuthoring.activityRail.repairProgress", {
                  attempt: task.workProgress.repairAttempt,
                  limit: task.workProgress.repairLimit,
                })}
              </p>
            )}
          {options.showChapterContext !== false && chapterContext && (
            <p className={cn(ROW_DETAIL_CLASS, "text-xs text-neutral-500")}>{chapterContext}</p>
          )}
          {task.kind === AUTHORING_TASK_KIND.DETAILED_PLAN &&
            task.workProgress?.chapters?.length && (
              <ol className={cn(ROW_DETAIL_CLASS, "space-y-0.5")}>
                {task.workProgress.chapters.map((chapter) => {
                  const chapterStatus =
                    task.status === AUTHORING_TASK_STATUS.SUCCEEDED
                      ? AUTHORING_CHAPTER_PROGRESS_STATUS.COMPLETE
                      : chapter.status;
                  let iconStatus: AuthoringTask["status"] = AUTHORING_TASK_STATUS.QUEUED;
                  if (chapterStatus === AUTHORING_CHAPTER_PROGRESS_STATUS.RUNNING)
                    iconStatus = AUTHORING_TASK_STATUS.RUNNING;
                  if (chapterStatus === AUTHORING_CHAPTER_PROGRESS_STATUS.COMPLETE)
                    iconStatus = AUTHORING_TASK_STATUS.SUCCEEDED;
                  if (chapterStatus === AUTHORING_CHAPTER_PROGRESS_STATUS.FAILED)
                    iconStatus = AUTHORING_TASK_STATUS.FAILED;

                  return (
                    <li
                      key={chapter.chapterId}
                      className="flex min-h-6 items-center gap-2 text-xs text-neutral-600"
                    >
                      <span className="shrink-0">{taskStatusIcon(iconStatus)}</span>
                      <span className="min-w-0 flex-1 truncate" title={chapter.title}>
                        {chapter.title}
                      </span>
                      <span className="shrink-0 text-neutral-500">
                        {t("courseAuthoring.activityRail.chapterLessonCount", {
                          count: chapter.lessonCount,
                        })}
                      </span>
                      <span className="shrink-0 text-neutral-500">
                        {t(`courseAuthoring.activityRail.chapterStatus.${chapterStatus}`)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          {(task.status === AUTHORING_TASK_STATUS.FAILED || task.failure) && (
            <p className={cn(ROW_DETAIL_CLASS, "text-xs text-destructive")}>
              {taskFailureLabel(task, t)}
            </p>
          )}
        </div>
      );
    }

    return (
      <div key={task.taskId} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
        <div className="flex min-h-7 items-center gap-2 leading-none">
          {taskStatusIcon(task.status)}
          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={label}>
            {label}
          </span>
          <Badge variant={statusVariant(task.status)} className="text-[10px]">
            {t(`courseAuthoring.activityRail.taskStatus.${taskStatusKey(task.status)}`)}
          </Badge>
          {canStop && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-md text-neutral-600 hover:bg-neutral-200 hover:text-neutral-950"
              disabled={busy}
              onClick={() => requestAction(task.requestId)}
              aria-label={requestActionLabel}
              title={requestActionLabel}
            >
              <Square className="size-3 fill-current" />
            </Button>
          )}
        </div>
        {options.showChapterContext !== false && chapterContext && (
          <p className="mt-2 pl-6 text-xs text-neutral-500">{chapterContext}</p>
        )}
        {(task.status === AUTHORING_TASK_STATUS.FAILED || task.failure) && (
          <div className="mt-2 text-xs text-destructive">
            <p>{taskFailureLabel(task, t)}</p>
          </div>
        )}
        <div className="mt-2 flex justify-end gap-1">
          {canRetryAuthoringTask(task) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onRetry(task.taskId)}
            >
              <RotateCcw className="mr-1 size-3.5" />{" "}
              {t(`courseAuthoring.activityRail.${authoringTaskRetryLabel(task)}`)}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderChapterWork = (group: ChapterWorkItem) => {
    const failed = group.tasks.some((item) => item.task.status === AUTHORING_TASK_STATUS.FAILED);
    const allSucceeded = group.tasks.every(
      (item) => item.task.status === AUTHORING_TASK_STATUS.SUCCEEDED,
    );
    const taskStatuses = group.tasks.map((item) => item.task.status);
    let status: AuthoringTask["status"] = AUTHORING_TASK_STATUS.QUEUED;
    if (failed) status = AUTHORING_TASK_STATUS.FAILED;
    else if (allSucceeded) status = AUTHORING_TASK_STATUS.SUCCEEDED;
    else if (taskStatuses.includes(AUTHORING_TASK_STATUS.RUNNING))
      status = AUTHORING_TASK_STATUS.RUNNING;
    else if (taskStatuses.includes(AUTHORING_TASK_STATUS.WAITING_AUTHOR))
      status = AUTHORING_TASK_STATUS.WAITING_AUTHOR;
    else if (taskStatuses.includes(AUTHORING_TASK_STATUS.PAUSED))
      status = AUTHORING_TASK_STATUS.PAUSED;
    else if (taskStatuses.includes(AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES))
      status = AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES;
    else if (taskStatuses.includes(AUTHORING_TASK_STATUS.QUEUED))
      status = AUTHORING_TASK_STATUS.QUEUED;
    else if (taskStatuses.every((taskStatus) => taskStatus === AUTHORING_TASK_STATUS.STOPPED))
      status = AUTHORING_TASK_STATUS.STOPPED;
    else if (taskStatuses.every((taskStatus) => taskStatus === AUTHORING_TASK_STATUS.SUPERSEDED)) {
      status = AUTHORING_TASK_STATUS.SUPERSEDED;
    }
    const total = Math.max(group.lessonCount, group.tasks.length);
    const completed = Math.min(
      total,
      group.tasks.filter((item) => item.task.status === AUTHORING_TASK_STATUS.SUCCEEDED).length,
    );
    const stopTask = group.tasks.find((item) => canStopTask(item.task))?.task;
    const canDiscard =
      stopTask &&
      [AUTHORING_TASK_STATUS.WAITING_AUTHOR, AUTHORING_TASK_STATUS.WAITING_DEPENDENCIES].some(
        (value) => value === stopTask.status,
      ) &&
      Boolean(onDiscardRequest);
    const requestAction = canDiscard && onDiscardRequest ? onDiscardRequest : onStopRequest;
    const requestActionLabel = canDiscard
      ? t("courseAuthoring.activityRail.discardRequest")
      : t("courseAuthoring.activityRail.stopRequest");
    const runningTasks = group.tasks.filter(
      (item) => item.task.status === AUTHORING_TASK_STATUS.RUNNING,
    );
    const visibleRunningTasks = runningTasks.slice(0, 3);
    const actionableTasks = group.tasks.filter((item) =>
      [AUTHORING_TASK_STATUS.WAITING_AUTHOR, AUTHORING_TASK_STATUS.FAILED].some(
        (value) => value === item.task.status,
      ),
    );
    const visibleTasks = [...visibleRunningTasks, ...actionableTasks].sort(
      (left, right) => left.sequence - right.sequence || left.index - right.index,
    );
    const visibleTaskIds = new Set(visibleTasks.map((item) => item.task.taskId));
    const chapterResearchTools = group.tools.filter((item) => isWebTool(item.tool.tool));
    const researchItems = groupResearchActivity(chapterResearchTools).filter(
      (item): item is ResearchWorkItem => item.kind === "research",
    );
    const startedTools = group.tools.filter(
      (item) =>
        !isWebTool(item.tool.tool) &&
        item.tool.taskId &&
        visibleTaskIds.has(item.tool.taskId) &&
        item.tool.tool.status === AUTHORING_TOOL_STATUS.STARTED,
    );
    const problemTools = group.tools.filter(
      (item) =>
        !isWebTool(item.tool.tool) &&
        [AUTHORING_TOOL_STATUS.FAILED, AUTHORING_TOOL_STATUS.STOPPED].some(
          (value) => value === item.tool.tool.status,
        ),
    );
    const visibleTools = [...startedTools.slice(0, 3), ...problemTools];
    const omittedRunningCount = runningTasks.length - visibleRunningTasks.length;
    const omittedToolCount = Math.max(0, startedTools.length - Math.min(startedTools.length, 3));
    const nestedWorkItems: Array<TaskWorkItem | ToolWorkItem | ResearchWorkItem> = [
      ...visibleTasks,
      ...visibleTools,
      ...researchItems,
    ].sort((left, right) => left.sequence - right.sequence || left.index - right.index);

    return (
      <div className="space-y-0.5">
        <div className={ROW_CLASS}>
          <span className="flex shrink-0">{taskStatusIcon(status)}</span>
          <span
            className="min-w-0 flex-1 truncate font-medium text-neutral-800"
            title={group.chapterTitle}
          >
            {group.chapterTitle}
          </span>
          {stopTask && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
              disabled={busy}
              onClick={() => requestAction(stopTask.requestId)}
              aria-label={requestActionLabel}
              title={requestActionLabel}
            >
              <Square className="size-3 fill-current" />
            </Button>
          )}
        </div>
        <p className={cn(ROW_DETAIL_CLASS, "-mt-1 text-xs tabular-nums text-neutral-500")}>
          {t("courseAuthoring.activityRail.chapterLessonsProgress", { completed, total })}
        </p>
        {nestedWorkItems.length > 0 && (
          <ol className="ml-[11px] space-y-0.5 border-l border-neutral-200 pl-2">
            {nestedWorkItems.map((item) => {
              if (item.kind === "task") {
                return (
                  <li key={item.task.taskId}>
                    {renderTask(item.task, { showStop: false, showChapterContext: false })}
                  </li>
                );
              }
              if (item.kind === "research") {
                return (
                  <li key={`research-${item.key}`}>
                    <AuthoringResearchActivity
                      tools={item.tools.map((toolItem) => toolItem.tool)}
                    />
                  </li>
                );
              }
              return (
                <li key={item.tool.tool.toolCallId}>
                  <AuthoringToolActivity {...item.tool} />
                </li>
              );
            })}
          </ol>
        )}
        {omittedRunningCount > 0 && (
          <p className={cn(ROW_DETAIL_CLASS, "text-xs text-neutral-500")}>
            {t("courseAuthoring.activityRail.moreLessonsRunning", {
              count: omittedRunningCount,
            })}
          </p>
        )}
        {omittedToolCount > 0 && (
          <p className={cn(ROW_DETAIL_CLASS, "text-xs text-neutral-500")}>
            {t("courseAuthoring.activityRail.moreToolUpdates", { count: omittedToolCount })}
          </p>
        )}
      </div>
    );
  };

  return (
    <aside className="space-y-4">
      {!compact && <AuthoringWorkProgressBar tasks={tasks} busy={busy} />}
      {compact ? (
        <AuthoringCollapsibleSection
          title={t("courseAuthoring.activityRail.liveWork")}
          icon={liveWorkIcon}
          detail={
            hasRunningWork && currentActivity ? (
              <span className="loading-text-shimmer">{currentActivity}</span>
            ) : undefined
          }
          summary={hasRunningWork ? <AuthoringElapsedTime className="text-xs" /> : workSummary}
          tone={liveWorkTone}
          progress={
            liveWorkTone === "success" ? undefined : (
              <AuthoringWorkProgressBar
                tasks={tasks}
                busy={busy || hasRunningWork}
                showLabel={false}
              />
            )
          }
          defaultOpen={needsAttention}
        >
          <ol className="space-y-1">
            {compactWorkItems.map((item) => {
              let key: string;
              let content: ReactNode;
              if (item.kind === "task") {
                key = item.task.taskId;
                content = renderTask(item.task);
              } else if (item.kind === "tool") {
                key = item.tool.tool.toolCallId;
                content = <AuthoringToolActivity {...item.tool} />;
              } else if (item.kind === "research") {
                key = `research-${item.key}`;
                content = (
                  <AuthoringResearchActivity tools={item.tools.map((toolItem) => toolItem.tool)} />
                );
              } else {
                key = item.key;
                content = renderChapterWork(item);
              }
              return <li key={key}>{content}</li>;
            })}
          </ol>
          {planSteps.length > 0 && (
            <div className="px-1 pt-2">
              <p className="mb-1 text-xs font-medium text-neutral-600">
                {t("courseAuthoring.activityRail.plan")}
              </p>
              <AuthoringPlanStepList steps={planSteps} />
            </div>
          )}
        </AuthoringCollapsibleSection>
      ) : (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("courseAuthoring.activityRail.liveWork")}</h2>
            <Badge variant={connectionVariant(connection)}>
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />{" "}
              {connectionLabel}
            </Badge>
          </div>
          <div className="mt-4 space-y-2">
            {tasks.length === 0 && (
              <p className="text-sm text-neutral-600">{t("courseAuthoring.activityRail.noWork")}</p>
            )}
            {tasks.map((task) => renderTask(task))}
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section className="rounded-xl border border-warning-200 bg-warning-50 p-4">
          <div className="flex items-center gap-2 text-warning-900">
            <AlertCircle className="size-4" />
            <h2 className="font-semibold">{t("courseAuthoring.activityRail.needsInput")}</h2>
          </div>
          <div className="mt-3 space-y-3">
            {questionGroups.map(([requestId, groupedQuestions]) => (
              <div key={requestId}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-warning-800">
                  {t("courseAuthoring.activityRail.request", { id: requestId.slice(0, 8) })}
                </p>
                <div className="space-y-2">
                  {groupedQuestions.map((question) => (
                    <div key={question.id} className="rounded-lg bg-white p-3">
                      <p className="text-sm font-medium">{question.prompt}</p>
                      {question.choices.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {question.choices.map((choice) => (
                            <Button
                              key={choice}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto max-w-full whitespace-normal text-left"
                              onClick={() =>
                                setAnswers((current) => ({ ...current, [question.id]: choice }))
                              }
                            >
                              <span className="min-w-0 break-words">{choice}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={answers[question.id] ?? ""}
                          aria-label={t("courseAuthoring.activityRail.yourAnswer")}
                          placeholder={t("courseAuthoring.activityRail.yourAnswer")}
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: event.target.value,
                            }))
                          }
                        />
                        <Button
                          type="button"
                          disabled={busy || !(answers[question.id] ?? "").trim()}
                          onClick={() => onAnswer(question, answers[question.id].trim())}
                        >
                          {t("courseAuthoring.activityRail.send")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {assetTasks.some((asset) =>
        [AUTHORING_TASK_STATUS.WAITING_AUTHOR, AUTHORING_TASK_STATUS.FAILED].some(
          (value) => value === asset.status,
        ),
      ) && (
        <section className="rounded-xl border border-neutral-200 bg-white px-4">
          <h2 className="border-b border-neutral-100 py-3 text-xs font-medium text-neutral-800">
            {t("courseAuthoring.activityRail.assetDecisions")}
          </h2>
          <div className="divide-y divide-neutral-100">
            {assetTasks
              .filter((asset) =>
                [AUTHORING_TASK_STATUS.WAITING_AUTHOR, AUTHORING_TASK_STATUS.FAILED].some(
                  (value) => value === asset.status,
                ),
              )
              .map((asset) => (
                <AuthoringAssetDecision
                  key={asset.taskId}
                  asset={asset}
                  omitted={
                    !asset.request.required &&
                    omittedOptionalAssetIds.includes(asset.request.assetId)
                  }
                  busy={busy}
                  onRetry={() => {
                    if (asset.action) onAssetAction(asset, asset.action);
                  }}
                  onSkip={() => onSkipAsset(asset.request.assetId)}
                  onRestore={() => onRestoreAsset?.(asset.request.assetId)}
                />
              ))}
          </div>
        </section>
      )}

      {applications.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">{t("courseAuthoring.activityRail.applicationHistory")}</h2>
          <div className="mt-3 space-y-2">
            {applications.map((application) => (
              <div
                key={application.id}
                className="flex items-center justify-between rounded-lg bg-neutral-50 p-2 text-sm"
              >
                <span>
                  {t("courseAuthoring.activityRail.apply", { id: application.id.slice(0, 8) })}
                </span>
                <Badge
                  variant={
                    application.status === AUTHORING_APPLICATION_STATUS.APPLIED
                      ? "success"
                      : "blocked"
                  }
                >
                  {t(`courseAuthoring.activityRail.applicationStatus.${application.status}`)}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
};
