/** Renders task progress, asset decisions and connection state for the workspace. */
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Globe,
  LoaderCircle,
  RotateCcw,
  Square,
  Wrench,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";

import { parseFetchedResearchSources } from "../authoringSources";
import {
  authoringTaskFailureLabel,
  authoringTaskRetryLabel,
  canRetryAuthoringTask,
} from "../authoringTaskFailure";

import { AuthoringCollapsibleSection } from "./AuthoringCollapsibleSection";
import { AuthoringSourceChipRow } from "./AuthoringSourceCitation";

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
  ["queued", "running", "waiting_author", "waiting_dependencies", "paused"].includes(task.status);

/** Groups only real lesson tasks with chapter context from durable progress metadata. */
const groupLessonWorkByChapter = (items: WorkItem[]): CompactWorkItem[] => {
  const candidatesByChapter = new Map<string, TaskWorkItem[]>();
  items.forEach((item) => {
    if (
      item.kind !== "task" ||
      item.task.kind !== "lesson" ||
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
  if (status === "succeeded") return "success" as const;
  if (["failed", "stopped", "superseded"].includes(status)) return "blocked" as const;
  return "inProgress" as const;
};

/** Maps task state to its localized activity label key. */
const taskStatusKey = (status: AuthoringTask["status"]) =>
  match(status)
    .with("succeeded", () => "complete")
    .with("waiting_author", () => "waitingAuthor")
    .with("waiting_dependencies", () => "waitingDependencies")
    .otherwise((value) => value);

/** Prefers the task kind: the phase can lag behind or describe a sibling step. */
const taskKindKey = (task: AuthoringTask) => {
  if (task.workProgress?.stage === "repairing") {
    return task.kind === "lesson" ? "revisingLesson" : "revisingLessonPlan";
  }
  if (task.kind === "course_review" || task.phase === "reviewing") return "checkingCourse";
  if (task.phase === "researching" || task.phase === "source_working") return "searchingSources";
  if (task.workProgress?.stage === "validation") {
    return task.kind === "lesson" ? "checkingLesson" : "checkingLessonPlan";
  }
  if (task.workProgress?.stage === "outline" || task.kind === "plan") return "planningOutline";
  if (task.workProgress?.stage === "lesson_planning" || task.kind === "detailed_plan") {
    return "planningLessons";
  }
  if (task.workProgress?.stage === "lesson_generation") return "generatingLesson";
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
    .with("succeeded", () => <CheckCircle2 className="size-4 text-success-700" />)
    .with("failed", () => <AlertCircle className="size-4 text-destructive" />)
    .with("running", () => <LoaderCircle className="size-4 animate-spin text-primary-700" />)
    .otherwise(() => <Clock3 className="size-4 text-neutral-500" />);

const WEB_TOOL_NAMES = new Set(["web_search", "research"]);
const MAX_VISIBLE_SEARCH_QUERIES = 12;

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

const AuthoringSearchQueries = ({ queries }: { queries: string[] }) => {
  const { t } = useTranslation();
  const visibleQueries = queries.slice(0, MAX_VISIBLE_SEARCH_QUERIES);
  const omittedQueries = queries.slice(visibleQueries.length);
  return (
    <>
      {visibleQueries.length > 0 && (
        <ul
          aria-label={t("courseAuthoring.activityRail.searchQueries")}
          className="ml-7 list-disc space-y-0.5 break-words pl-3 text-xs text-neutral-600"
        >
          {visibleQueries.map((query) => (
            <li key={query} className="break-words">
              {query}
            </li>
          ))}
        </ul>
      )}
      {omittedQueries.length > 0 && (
        <details className="ml-7 text-xs text-neutral-500">
          <summary className="cursor-pointer">
            {t("courseAuthoring.activityRail.moreSearchQueries", { count: omittedQueries.length })}
          </summary>
          <ul className="ml-3 list-disc space-y-0.5 break-words pl-3 pt-1">
            {omittedQueries.map((query) => (
              <li key={query} className="break-words">
                {query}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
};

const AuthoringResearchSources = ({ tools }: { tools: ToolActivity[] }) => {
  const sources = parseFetchedResearchSources(
    tools.flatMap(({ tool }) => tool.result?.sources ?? []),
  ).map(({ url, title }) => ({ url, label: title }));
  if (sources.length === 0) return null;
  return (
    <div className="ml-7">
      <AuthoringSourceChipRow sources={sources} />
    </div>
  );
};

const AuthoringResearchActivity = ({ tools }: { tools: ToolActivity[] }) => {
  const orderedTools = [...tools].sort((left, right) => left.sequence - right.sequence);
  const representative =
    orderedTools.find(({ tool }) => tool.status === "started") ??
    orderedTools.find(({ tool }) => tool.status === "failed" || tool.status === "stopped") ??
    orderedTools[orderedTools.length - 1];
  if (!representative) return null;

  const queries = searchQueriesForTools(orderedTools);
  const taskLabel = orderedTools.find((item) => item.taskLabel)?.taskLabel;
  return (
    <div className="space-y-0.5">
      <AuthoringToolActivity
        {...representative}
        taskLabel={taskLabel}
        showCounts={false}
        showQueries={false}
        showSources={false}
      />
      <AuthoringSearchQueries queries={queries} />
      <AuthoringResearchSources tools={orderedTools} />
    </div>
  );
};

export const AuthoringToolActivity = ({
  tool,
  taskLabel,
  showCounts = true,
  showQueries = true,
  showSources = true,
}: Pick<ToolActivity, "tool" | "taskLabel"> & {
  showCounts?: boolean;
  showQueries?: boolean;
  showSources?: boolean;
}) => {
  const { t } = useTranslation();
  const isWebToolActivity = isWebTool(tool);
  const isExtraction = tool.toolName === "web_extract";
  const isRunning = tool.status === "started";
  const isProblem = tool.status === "failed" || tool.status === "stopped";
  let label = tool.display;
  if (isExtraction) label = t(`courseAuthoring.conversation.webExtractTool.${tool.status}`);
  else if (isWebToolActivity)
    label = t(`courseAuthoring.conversation.webSearchTool.${tool.status}`);
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
  }

  return (
    <div className="space-y-0.5">
      <div
        data-testid={`course-authoring-tool-${tool.toolCallId}`}
        role="status"
        title={isWebToolActivity && tool.display !== label ? tool.display : undefined}
        className="flex items-center gap-1.5 px-1 py-1 text-xs text-neutral-500"
      >
        {icon}
        <span className={cn(isRunning && "loading-text-shimmer", isProblem && "text-neutral-700")}>
          {label}
        </span>
        {taskLabel && <span className="text-neutral-400">· {taskLabel}</span>}
        {!isWebToolActivity && !isExtraction && isProblem && (
          <span className="text-neutral-500">
            · {t(`courseAuthoring.activityRail.taskStatus.${tool.status}`)}
          </span>
        )}
        {showCounts && counts.length > 0 && (
          <span className="text-neutral-400">· {counts.join(" · ")}</span>
        )}
      </div>
      {isExtraction && typeof tool.result?.query === "string" && (
        <p className="ml-7 break-all text-xs text-neutral-600">{tool.result.query}</p>
      )}
      {(isWebToolActivity || isExtraction) && showSources && (
        <AuthoringResearchSources tools={[{ tool, sequence: 0 }]} />
      )}
      {isWebToolActivity && showQueries && (
        <AuthoringSearchQueries queries={searchQueriesForTools([{ tool, sequence: 0 }])} />
      )}
    </div>
  );
};

/** Maps socket state to the shared connection badge variant. */
const connectionVariant = (connection: AuthoringConnectionState) =>
  match(connection)
    .with("live", () => "success" as const)
    .with("offline", () => "blocked" as const)
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
}: Props) => {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const completed = tasks.filter((task) =>
    ["succeeded", "failed", "superseded", "stopped"].includes(task.status),
  ).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const succeeded = tasks.filter((task) => task.status === "succeeded").length;
  const lessonTasks = tasks.filter((task) => task.kind === "lesson");
  const lessonProgress = lessonTasks.flatMap((task) =>
    task.workProgress &&
    ["lesson_generation", "validation", "repairing"].includes(task.workProgress.stage)
      ? [task.workProgress]
      : [],
  );
  const completedLessons = Math.max(
    lessonTasks.filter((task) => task.status === "succeeded").length,
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
  const manyLessons = compact && lessonTasks.length > 0 && totalLessons >= 8;
  const detailedPlanTask = tasks.find(
    (task) => task.kind === "detailed_plan" && task.workProgress?.chapters?.length,
  );
  const plannedChapters = detailedPlanTask?.workProgress?.chapters ?? [];
  const completedChapters =
    detailedPlanTask?.status === "succeeded"
      ? plannedChapters.length
      : plannedChapters.filter((chapter) => chapter.status === "complete").length;
  const hasOpenWork =
    tasks.some((task) => !["succeeded", "superseded", "stopped"].includes(task.status)) ||
    tools.some(({ tool }) => tool.status === "started" || tool.status === "failed");
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
  const hasSearchQueryHistory =
    searchQueriesForTools(tools.filter(({ tool }) => isWebTool(tool))).length > 0;
  const connectionLabel = match(connection)
    .with("live", () => t("courseAuthoring.activityRail.connection.live"))
    .with("offline", () => t("courseAuthoring.activityRail.connection.offline"))
    .with("recovering", () => t("courseAuthoring.activityRail.connection.recovering"))
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
      completed: succeeded + tools.filter(({ tool }) => tool.status === "completed").length,
      total: tasks.length + tools.length,
    });
  }

  const renderTask = (
    task: AuthoringTask,
    options: { showStop?: boolean; showChapterContext?: boolean } = {},
  ) => {
    let label = taskLabels[task.taskId] ?? task.workProgress?.lessonTitle ?? taskKindLabel(task, t);
    if (task.kind === "detailed_plan" && task.workProgress) label = taskKindLabel(task, t);
    if (task.workProgress?.stage === "recovering") {
      label = t("courseAuthoring.activityRail.recoveringFailedParts");
    }
    const canStop = options.showStop !== false && canStopTask(task);
    const canDiscard = ["waiting_author", "waiting_dependencies"].includes(task.status);
    const requestAction = canDiscard && onDiscardRequest ? onDiscardRequest : onStopRequest;
    const requestActionLabel =
      canDiscard && onDiscardRequest
        ? t("courseAuthoring.activityRail.discardRequest")
        : t("courseAuthoring.activityRail.stopRequest");
    let chapterContext: string | null = null;
    if (task.workProgress?.chapterTitle) {
      if (task.workProgress.lessonTitle && task.workProgress.stage === "lesson_planning") {
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
        <div key={task.taskId} className="space-y-0.5 px-1 py-1 text-sm">
          <div className="flex min-h-8 items-center gap-2">
            <span className="shrink-0">{taskStatusIcon(task.status)}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-neutral-800" title={label}>
              {label}
            </span>
            <span className="shrink-0 text-xs text-neutral-500">
              {t(`courseAuthoring.activityRail.taskStatus.${taskStatusKey(task.status)}`)}
            </span>
            {canStop && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-950"
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
                className="size-7 shrink-0 rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-950"
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
              <p className="pl-6 text-xs text-neutral-500">
                {t("courseAuthoring.activityRail.repairProgress", {
                  attempt: task.workProgress.repairAttempt,
                  limit: task.workProgress.repairLimit,
                })}
              </p>
            )}
          {options.showChapterContext !== false && chapterContext && (
            <p className="pl-6 text-xs text-neutral-500">{chapterContext}</p>
          )}
          {task.kind === "detailed_plan" && task.workProgress?.chapters?.length && (
            <ol className="ml-6 space-y-0.5 border-l border-neutral-200 pl-2">
              {task.workProgress.chapters.map((chapter) => {
                const chapterStatus = task.status === "succeeded" ? "complete" : chapter.status;
                let iconStatus: AuthoringTask["status"] = "queued";
                if (chapterStatus === "running") iconStatus = "running";
                if (chapterStatus === "complete") iconStatus = "succeeded";
                if (chapterStatus === "failed") iconStatus = "failed";

                return (
                  <li
                    key={chapter.chapterId}
                    className="flex min-h-7 items-center gap-2 px-1 text-xs text-neutral-700"
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
          {(task.status === "failed" || task.failure) && (
            <p className="pl-6 text-xs text-destructive">{taskFailureLabel(task, t)}</p>
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
        {(task.status === "failed" || task.failure) && (
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
    const failed = group.tasks.some((item) => item.task.status === "failed");
    const allSucceeded = group.tasks.every((item) => item.task.status === "succeeded");
    const taskStatuses = group.tasks.map((item) => item.task.status);
    let status: AuthoringTask["status"] = "queued";
    if (failed) status = "failed";
    else if (allSucceeded) status = "succeeded";
    else if (taskStatuses.includes("running")) status = "running";
    else if (taskStatuses.includes("waiting_author")) status = "waiting_author";
    else if (taskStatuses.includes("paused")) status = "paused";
    else if (taskStatuses.includes("waiting_dependencies")) status = "waiting_dependencies";
    else if (taskStatuses.includes("queued")) status = "queued";
    else if (taskStatuses.every((taskStatus) => taskStatus === "stopped")) status = "stopped";
    else if (taskStatuses.every((taskStatus) => taskStatus === "superseded")) {
      status = "superseded";
    }
    const total = Math.max(group.lessonCount, group.tasks.length);
    const completed = Math.min(
      total,
      group.tasks.filter((item) => item.task.status === "succeeded").length,
    );
    const stopTask = group.tasks.find((item) => canStopTask(item.task))?.task;
    const canDiscard =
      stopTask &&
      ["waiting_author", "waiting_dependencies"].includes(stopTask.status) &&
      Boolean(onDiscardRequest);
    const requestAction = canDiscard && onDiscardRequest ? onDiscardRequest : onStopRequest;
    const requestActionLabel = canDiscard
      ? t("courseAuthoring.activityRail.discardRequest")
      : t("courseAuthoring.activityRail.stopRequest");
    const runningTasks = group.tasks.filter((item) => item.task.status === "running");
    const visibleRunningTasks = runningTasks.slice(0, 3);
    const actionableTasks = group.tasks.filter((item) =>
      ["waiting_author", "failed"].includes(item.task.status),
    );
    const visibleTasks = [...visibleRunningTasks, ...actionableTasks].sort(
      (left, right) => left.sequence - right.sequence || left.index - right.index,
    );
    const visibleTaskIds = new Set(visibleTasks.map((item) => item.task.taskId));
    const chapterResearchTools = group.tools.filter((item) => isWebTool(item.tool.tool));
    const researchItems = groupResearchActivity(chapterResearchTools).filter(
      (item): item is ResearchWorkItem => item.kind === "research",
    );
    const completedResearchSteps = group.tools.filter(
      (item) => item.tool.tool.status === "completed",
    ).length;
    const startedTools = group.tools.filter(
      (item) =>
        !isWebTool(item.tool.tool) &&
        item.tool.taskId &&
        visibleTaskIds.has(item.tool.taskId) &&
        item.tool.tool.status === "started",
    );
    const problemTools = group.tools.filter(
      (item) => !isWebTool(item.tool.tool) && ["failed", "stopped"].includes(item.tool.tool.status),
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
      <div className="space-y-1 px-1 py-1">
        <div className="flex min-h-8 items-center gap-2 text-sm">
          <span className="shrink-0">{taskStatusIcon(status)}</span>
          <span
            className="min-w-0 flex-1 truncate font-medium text-neutral-800"
            title={group.chapterTitle}
          >
            {group.chapterTitle}
          </span>
          <span className="shrink-0 text-xs text-neutral-500">
            {t("courseAuthoring.activityRail.chapterLessonsProgress", { completed, total })}
          </span>
          {stopTask && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-950"
              disabled={busy}
              onClick={() => requestAction(stopTask.requestId)}
              aria-label={requestActionLabel}
              title={requestActionLabel}
            >
              <Square className="size-3 fill-current" />
            </Button>
          )}
        </div>
        {completedResearchSteps > 0 && (
          <p className="pl-6 text-xs text-neutral-500">
            {t("courseAuthoring.activityRail.completedResearchSteps", {
              count: completedResearchSteps,
            })}
          </p>
        )}
        {nestedWorkItems.length > 0 && (
          <ol className="ml-3 space-y-0.5 border-l border-neutral-200 pl-2">
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
          <p className="pl-6 text-xs text-neutral-500">
            {t("courseAuthoring.activityRail.moreLessonsRunning", {
              count: omittedRunningCount,
            })}
          </p>
        )}
        {omittedToolCount > 0 && (
          <p className="pl-6 text-xs text-neutral-500">
            {t("courseAuthoring.activityRail.moreToolUpdates", { count: omittedToolCount })}
          </p>
        )}
      </div>
    );
  };

  return (
    <aside className="space-y-4">
      {compact ? (
        <AuthoringCollapsibleSection
          title={t("courseAuthoring.activityRail.liveWork")}
          summary={workSummary}
          defaultOpen={(hasOpenWork && !manyLessons) || hasSearchQueryHistory}
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
              <p className="text-xs font-medium text-neutral-600">
                {t("courseAuthoring.activityRail.plan")}
              </p>
              <ol className="mt-1 space-y-1 py-1">
                {planSteps.map((step, index) => (
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
          <div className="mt-4 flex items-center justify-between text-xs text-neutral-600">
            <span>
              {t("courseAuthoring.activityRail.taskProgress", { completed, total: tasks.length })}
            </span>
            <span>{t("courseAuthoring.activityRail.progress", { value: progress })}</span>
          </div>
          <Progress value={progress} className="mt-2 h-1.5" />
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

      {assetTasks.some((asset) => ["waiting_author", "failed"].includes(asset.status)) && (
        <section className="rounded-xl border border-warning-200 bg-warning-50 p-4">
          <div className="flex items-center gap-2 text-warning-900">
            <AlertCircle className="size-4" />
            <h2 className="font-semibold">{t("courseAuthoring.activityRail.assetDecisions")}</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-warning-900">
            {t("courseAuthoring.activityRail.assetGuidance")}
          </p>
          <div className="mt-3 space-y-3">
            {assetTasks
              .filter((asset) => ["waiting_author", "failed"].includes(asset.status))
              .map((asset) => {
                const approveLabel = t("courseAuthoring.activityRail.approveRetry");
                return (
                  <div key={asset.taskId} className="rounded-lg bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{asset.request.altText}</p>
                          <Badge
                            variant={asset.request.required ? "blocked" : "secondaryWithOutline"}
                            className="text-[10px]"
                          >
                            {t(
                              asset.request.required
                                ? "courseAuthoring.activityRail.required"
                                : "courseAuthoring.activityRail.optional",
                            )}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-neutral-600">
                          {asset.question ??
                            t("courseAuthoring.activityRail.assetDecisionFallback")}
                        </p>
                      </div>
                      <Badge variant="inProgress" className="text-[10px]">
                        {t(
                          `courseAuthoring.activityRail.assetStatus.${taskStatusKey(asset.status)}`,
                        )}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-neutral-700">
                      {t("courseAuthoring.activityRail.generatedVisual", {
                        content: asset.request.source.content,
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1"
                        disabled={busy || asset.revision === null || asset.action === null}
                        onClick={() => {
                          if (asset.action) onAssetAction(asset, asset.action);
                        }}
                      >
                        <Check className="size-3.5" /> {approveLabel}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={asset.request.required}
                        onClick={() => onSkipAsset(asset.request.assetId)}
                      >
                        {t(
                          asset.request.required
                            ? "courseAuthoring.activityRail.requiredScopeChange"
                            : "courseAuthoring.activityRail.skipOptionalAsset",
                        )}
                      </Button>
                    </div>
                    {asset.request.required && (
                      <p className="mt-2 text-right text-xs text-destructive">
                        {t("courseAuthoring.activityRail.requiredCannotSkip")}
                      </p>
                    )}
                  </div>
                );
              })}
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
                <Badge variant={application.status === "applied" ? "success" : "blocked"}>
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
