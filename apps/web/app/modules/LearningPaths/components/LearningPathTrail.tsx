import { Link } from "@remix-run/react";
import { COURSE_PROGRESS_STATUSES } from "@repo/shared";
import { BookOpen, Check, GripVertical, Lock, Play, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Icon } from "~/components/Icon";
import { SortableList } from "~/components/SortableList/SortableList";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { cn } from "~/lib/utils";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { LEARNING_PATH_TRAIL_HANDLES } from "../../../../e2e/data/learning-paths/handles";

import { LearningPathAddCoursesDialog } from "./LearningPathAddCoursesDialog";

import type {
  LearningPathCourseOption,
  LearningPathCoursePreview,
  SortableLearningPathCourse,
} from "./learningPaths.types";
import type { CSSProperties, ReactNode } from "react";

const TRAIL_STOP_STATES = {
  COMPLETED: "completed",
  IN_PROGRESS: "inProgress",
  NOT_STARTED: "notStarted",
  LOCKED: "locked",
  NEUTRAL: "neutral",
} as const;

type TrailStopState = (typeof TRAIL_STOP_STATES)[keyof typeof TRAIL_STOP_STATES];

const TRAIL_CONNECTOR_DIRECTIONS = {
  RIGHT: "right",
  LEFT: "left",
  TURN_RIGHT: "turnRight",
  TURN_LEFT: "turnLeft",
  DOWN: "down",
} as const;

const TRAIL_CONNECTOR_TONES = {
  COMPLETED: "completed",
  IN_PROGRESS: "inProgress",
  PENDING: "pending",
} as const;

type TrailConnectorTone = (typeof TRAIL_CONNECTOR_TONES)[keyof typeof TRAIL_CONNECTOR_TONES];

type TrailConnectorDirection =
  (typeof TRAIL_CONNECTOR_DIRECTIONS)[keyof typeof TRAIL_CONNECTOR_DIRECTIONS];

const TRAIL_CELL_WIDTH = 168;
const TRAIL_ROW_HEIGHT = 196;
const TRAIL_NODE_TOP = 12;
const TRAIL_NODE_SIZE = 84;
const TRAIL_NODE_CENTER_Y = TRAIL_NODE_TOP + TRAIL_NODE_SIZE / 2;
const TRAIL_LINE_WIDTH = 3;
const TRAIL_TURN_OVERHANG = 16;
const TRAIL_TURN_RADIUS = 40;
const DEFAULT_TRAIL_COLUMN_COUNT = 4;
const COURSE_PREVIEW_OPEN_DELAY_MS = 400;
const COURSE_PREVIEW_CLOSE_DELAY_MS = 100;
const COURSE_PREVIEW_HIDDEN_STATE = { opacity: 0, scale: 0.92 };
const COURSE_PREVIEW_VISIBLE_STATE = { opacity: 1, scale: 1 };
const COURSE_PREVIEW_TRANSITION = { duration: 0.6, ease: [0.22, 1, 0.36, 1] } as const;
const TRAIL_NODE_CONTROL_SIZE = 28;
const TRAIL_NODE_CONTROL_OFFSET = TRAIL_NODE_SIZE / 2 - 6;
const TRAIL_NODE_CONTROL_TOP =
  TRAIL_NODE_CENTER_Y - TRAIL_NODE_CONTROL_OFFSET - TRAIL_NODE_CONTROL_SIZE / 2;

type LearningPathTrailProps = {
  courses: LearningPathCoursePreview[];
  availableCourseOptions: LearningPathCourseOption[];
  canManage: boolean;
  canOpenCourses: boolean;
  showProgress: boolean;
  isPending: boolean;
  onAddCourses: (courseIds: string[]) => Promise<void>;
  onReorderCourses: (courseIds: string[]) => Promise<void>;
  onRemoveCourse: (courseId: string) => Promise<void>;
};

const mapToSortableCourses = (courses: LearningPathCoursePreview[]) =>
  courses.map((course) => ({ ...course, sortableId: course.courseId }));

export const findCurrentTrailCourse = (courses: LearningPathCoursePreview[]) =>
  courses.find(
    (course) =>
      !course.isLocked &&
      course.progress !== COURSE_PROGRESS_STATUSES.COMPLETED &&
      course.progress !== COURSE_PROGRESS_STATUSES.BLOCKED,
  );

const getTrailStopState = ({
  course,
  showProgress,
}: {
  course: LearningPathCoursePreview;
  showProgress: boolean;
}): TrailStopState =>
  match({ showProgress, isLocked: course.isLocked, progress: course.progress })
    .with({ showProgress: false }, () => TRAIL_STOP_STATES.NEUTRAL)
    .with({ progress: COURSE_PROGRESS_STATUSES.COMPLETED }, () => TRAIL_STOP_STATES.COMPLETED)
    .with({ isLocked: true }, () => TRAIL_STOP_STATES.LOCKED)
    .with({ progress: COURSE_PROGRESS_STATUSES.BLOCKED }, () => TRAIL_STOP_STATES.LOCKED)
    .with({ progress: COURSE_PROGRESS_STATUSES.IN_PROGRESS }, () => TRAIL_STOP_STATES.IN_PROGRESS)
    .otherwise(() => TRAIL_STOP_STATES.NOT_STARTED);

const getTrailCellPosition = (index: number, columnCount: number) => {
  const row = Math.floor(index / columnCount);
  const positionInRow = index % columnCount;
  const column = row % 2 === 0 ? positionInRow : columnCount - 1 - positionInRow;

  return { row, column };
};

const getTrailConnectorDirection = ({
  index,
  itemCount,
  columnCount,
}: {
  index: number;
  itemCount: number;
  columnCount: number;
}): TrailConnectorDirection | null => {
  if (index >= itemCount - 1) return null;

  const { row } = getTrailCellPosition(index, columnCount);
  const isNextInSameRow = Math.floor((index + 1) / columnCount) === row;
  const isRowGoingRight = row % 2 === 0;

  return match({ columnCount, isNextInSameRow, isRowGoingRight })
    .with({ columnCount: 1 }, () => TRAIL_CONNECTOR_DIRECTIONS.DOWN)
    .with({ isNextInSameRow: true, isRowGoingRight: true }, () => TRAIL_CONNECTOR_DIRECTIONS.RIGHT)
    .with({ isNextInSameRow: true, isRowGoingRight: false }, () => TRAIL_CONNECTOR_DIRECTIONS.LEFT)
    .with({ isRowGoingRight: true }, () => TRAIL_CONNECTOR_DIRECTIONS.TURN_RIGHT)
    .otherwise(() => TRAIL_CONNECTOR_DIRECTIONS.TURN_LEFT);
};

const getTrailCellStyle = (index: number, columnCount: number): CSSProperties => {
  const { row, column } = getTrailCellPosition(index, columnCount);

  return { gridRow: row + 1, gridColumn: column + 1 };
};

const getTrailConnectorStyle = (direction: TrailConnectorDirection): CSSProperties => {
  const lineTop = TRAIL_NODE_CENTER_Y - TRAIL_LINE_WIDTH / 2;
  const turnWidth = TRAIL_CELL_WIDTH / 2 + TRAIL_TURN_OVERHANG;

  return match(direction)
    .with(TRAIL_CONNECTOR_DIRECTIONS.RIGHT, () => ({
      top: lineTop,
      left: "50%",
      width: TRAIL_CELL_WIDTH,
      borderTopWidth: TRAIL_LINE_WIDTH,
    }))
    .with(TRAIL_CONNECTOR_DIRECTIONS.LEFT, () => ({
      top: lineTop,
      right: "50%",
      width: TRAIL_CELL_WIDTH,
      borderTopWidth: TRAIL_LINE_WIDTH,
    }))
    .with(TRAIL_CONNECTOR_DIRECTIONS.TURN_RIGHT, () => ({
      top: lineTop,
      left: "50%",
      width: turnWidth,
      height: TRAIL_ROW_HEIGHT + TRAIL_LINE_WIDTH,
      borderWidth: `${TRAIL_LINE_WIDTH}px ${TRAIL_LINE_WIDTH}px ${TRAIL_LINE_WIDTH}px 0`,
      borderTopRightRadius: TRAIL_TURN_RADIUS,
      borderBottomRightRadius: TRAIL_TURN_RADIUS,
    }))
    .with(TRAIL_CONNECTOR_DIRECTIONS.TURN_LEFT, () => ({
      top: lineTop,
      right: "50%",
      width: turnWidth,
      height: TRAIL_ROW_HEIGHT + TRAIL_LINE_WIDTH,
      borderWidth: `${TRAIL_LINE_WIDTH}px 0 ${TRAIL_LINE_WIDTH}px ${TRAIL_LINE_WIDTH}px`,
      borderTopLeftRadius: TRAIL_TURN_RADIUS,
      borderBottomLeftRadius: TRAIL_TURN_RADIUS,
    }))
    .with(TRAIL_CONNECTOR_DIRECTIONS.DOWN, () => ({
      top: TRAIL_NODE_CENTER_Y,
      left: `calc(50% - ${TRAIL_LINE_WIDTH / 2}px)`,
      height: TRAIL_ROW_HEIGHT,
      borderLeftWidth: TRAIL_LINE_WIDTH,
    }))
    .exhaustive();
};

const STARTED_COURSE_PROGRESS_STATUSES: string[] = [
  COURSE_PROGRESS_STATUSES.IN_PROGRESS,
  COURSE_PROGRESS_STATUSES.COMPLETED,
];

const getTrailConnectorTone = ({
  fromCourse,
  toCourse,
  showProgress,
}: {
  fromCourse?: LearningPathCoursePreview;
  toCourse?: LearningPathCoursePreview;
  showProgress: boolean;
}): TrailConnectorTone =>
  match({
    showProgress,
    fromProgress: fromCourse?.progress,
    toProgress: toCourse?.progress,
  })
    .with({ showProgress: false }, () => TRAIL_CONNECTOR_TONES.PENDING)
    .with(
      {
        fromProgress: COURSE_PROGRESS_STATUSES.COMPLETED,
        toProgress: COURSE_PROGRESS_STATUSES.COMPLETED,
      },
      () => TRAIL_CONNECTOR_TONES.COMPLETED,
    )
    .when(
      ({ fromProgress, toProgress }) =>
        STARTED_COURSE_PROGRESS_STATUSES.includes(fromProgress ?? "") &&
        STARTED_COURSE_PROGRESS_STATUSES.includes(toProgress ?? ""),
      () => TRAIL_CONNECTOR_TONES.IN_PROGRESS,
    )
    .otherwise(() => TRAIL_CONNECTOR_TONES.PENDING);

function TrailConnector({
  direction,
  tone,
}: {
  direction: TrailConnectorDirection | null;
  tone: TrailConnectorTone;
}) {
  if (!direction) return null;

  return (
    <span
      aria-hidden
      style={getTrailConnectorStyle(direction)}
      className={cn(
        "pointer-events-none absolute z-0 border-0",
        match(tone)
          .with(TRAIL_CONNECTOR_TONES.COMPLETED, () => "border-solid border-success-500")
          .with(TRAIL_CONNECTOR_TONES.IN_PROGRESS, () => "border-solid border-warning-400")
          .with(TRAIL_CONNECTOR_TONES.PENDING, () => "border-dashed border-neutral-300")
          .exhaustive(),
      )}
    />
  );
}

function useTrailColumnCount() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(DEFAULT_TRAIL_COLUMN_COUNT);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateColumnCount = (containerWidth: number) => {
      const usableWidth = containerWidth - 2 * TRAIL_TURN_OVERHANG;
      setColumnCount(Math.max(1, Math.floor(usableWidth / TRAIL_CELL_WIDTH)));
    };

    updateColumnCount(container.getBoundingClientRect().width);

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) updateColumnCount(entry.contentRect.width);
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return { containerRef, columnCount };
}

function TrailStopLabel({
  eyebrow,
  title,
  caption,
  className,
}: {
  eyebrow?: string;
  title: string;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col items-center px-3 text-center", className)}>
      {eyebrow && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
          {eyebrow}
        </span>
      )}
      <span className="line-clamp-2 text-sm font-semibold leading-5 text-neutral-950">{title}</span>
      {caption}
    </span>
  );
}

type TrailCoursePreviewCardProps = {
  course: LearningPathCoursePreview;
  title: string;
  stateLabel?: string;
  isOpenable: boolean;
};

function TrailCoursePreviewCard({
  course,
  title,
  stateLabel,
  isOpenable,
}: TrailCoursePreviewCardProps) {
  const { t } = useTranslation();
  const description = course.description ? stripHtmlTags(course.description) : undefined;

  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
      data-testid={LEARNING_PATH_TRAIL_HANDLES.COURSE_PREVIEW}
    >
      <div className="relative aspect-video bg-neutral-100">
        <img
          src={course.thumbnailUrl || DefaultPhotoCourse}
          alt=""
          className="size-full object-cover"
          onError={(event) => {
            event.currentTarget.src = DefaultPhotoCourse;
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent_60%)]"
        />
      </div>
      <div className="space-y-3 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900">{title}</h3>

        {!!course.courseChapterCount && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-700">
            <BookOpen className="size-3.5" />
            <span>
              {t("adminLearningPathsView.courses.chapter", { count: course.courseChapterCount })}
            </span>
          </div>
        )}

        {description && <p className="line-clamp-2 text-xs text-neutral-600">{description}</p>}

        <div className="flex items-center justify-between gap-3">
          {stateLabel ? (
            <span className="rounded bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
              {stateLabel}
            </span>
          ) : (
            <span />
          )}
          {isOpenable && (
            <Link
              to={`/course/${course.courseId}`}
              aria-label={title}
              data-testid={LEARNING_PATH_TRAIL_HANDLES.COURSE_PREVIEW_OPEN_LINK}
              className="flex size-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md transition-transform duration-200 hover:scale-110"
            >
              <Play className="size-4" fill="currentColor" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

type TrailCourseStopProps = {
  course: LearningPathCoursePreview;
  state: TrailStopState;
  isCurrent: boolean;
  canOpenCourse: boolean;
  canManage: boolean;
  isPending: boolean;
  onRemoveCourse: (courseId: string) => Promise<void>;
};

function TrailCourseStop({
  course,
  state,
  isCurrent,
  canOpenCourse,
  canManage,
  isPending,
  onRemoveCourse,
}: TrailCourseStopProps) {
  const { t } = useTranslation();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const title = course.title || t("adminLearningPathsView.courses.unknownCourse");
  const isOpenable = canOpenCourse && state !== TRAIL_STOP_STATES.LOCKED;

  const stateConfig = match(state)
    .with(TRAIL_STOP_STATES.COMPLETED, () => ({
      ringClassName: "ring-success-500",
      glowClassName: "bg-[color-mix(in_srgb,var(--success-200)_70%,transparent)]",
      badge: <Check className="size-3.5" strokeWidth={3} />,
      badgeClassName: "bg-success-500 text-white",
      caption: t("learningPathsView.courseState.completed"),
    }))
    .with(TRAIL_STOP_STATES.IN_PROGRESS, () => ({
      ringClassName: "ring-warning-400",
      glowClassName: "bg-[color-mix(in_srgb,var(--warning-200)_70%,transparent)]",
      badge: <Icon name="InProgress" className="size-4" />,
      badgeClassName: "bg-white shadow",
      caption: t("learningPathsView.courseState.inProgress"),
    }))
    .with(TRAIL_STOP_STATES.NOT_STARTED, () => ({
      ringClassName: "ring-neutral-200",
      glowClassName: "bg-[color-mix(in_srgb,var(--neutral-200)_80%,transparent)]",
      badge: null,
      badgeClassName: "bg-neutral-400 text-white",
      caption: t("learningPathsView.courseState.notStarted"),
    }))
    .with(TRAIL_STOP_STATES.LOCKED, () => ({
      ringClassName: "ring-neutral-200",
      glowClassName: "bg-[color-mix(in_srgb,var(--neutral-200)_80%,transparent)]",
      badge: <Lock className="size-3.5" />,
      badgeClassName: "bg-neutral-700 text-white",
      caption: t("learningPathsView.courseState.locked"),
    }))
    .with(TRAIL_STOP_STATES.NEUTRAL, () => ({
      ringClassName: "ring-primary-100",
      glowClassName: "",
      badge: null,
      badgeClassName: "",
      caption: undefined,
    }))
    .exhaustive();

  const nodeBadge = isCurrent ? (
    <Play className="size-3.5" fill="currentColor" />
  ) : (
    stateConfig.badge
  );
  const isLocked = state === TRAIL_STOP_STATES.LOCKED;

  const node = (
    <span className="relative grid size-[84px] shrink-0 place-items-center">
      {isCurrent && (
        <span
          aria-hidden
          className={cn(
            "absolute -inset-2 animate-pulse rounded-[22px]",
            stateConfig.glowClassName,
          )}
        />
      )}
      <span
        className={cn(
          "relative size-full overflow-hidden rounded-2xl bg-neutral-100 ring-4 ring-offset-2 ring-offset-white transition-transform duration-300",
          stateConfig.ringClassName,
          { "group-hover:scale-105": isOpenable },
        )}
      >
        <img
          src={course.thumbnailUrl || DefaultPhotoCourse}
          alt={title}
          className={cn("size-full object-cover", { "opacity-50 grayscale": isLocked })}
          onError={(event) => {
            event.currentTarget.src = DefaultPhotoCourse;
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/stop:opacity-100 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--primary-800)_70%,transparent),color-mix(in_srgb,var(--primary-500)_30%,transparent))]"
        />
      </span>
      {nodeBadge && (
        <span
          className={cn(
            "absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full ring-2 ring-white",
            stateConfig.badgeClassName,
          )}
        >
          {nodeBadge}
        </span>
      )}
    </span>
  );

  const label = (
    <TrailStopLabel
      title={title}
      caption={stateConfig.caption && <span className="sr-only">{stateConfig.caption}</span>}
    />
  );

  const nodeWithPreview = (
    <HoverCard
      open={isPreviewOpen}
      onOpenChange={setIsPreviewOpen}
      openDelay={COURSE_PREVIEW_OPEN_DELAY_MS}
      closeDelay={COURSE_PREVIEW_CLOSE_DELAY_MS}
    >
      <HoverCardTrigger asChild>{node}</HoverCardTrigger>
      <AnimatePresence>
        {isPreviewOpen && (
          <HoverCardContent
            forceMount
            side="right"
            sideOffset={16}
            collisionPadding={16}
            className="w-[300px]"
          >
            <motion.div
              initial={COURSE_PREVIEW_HIDDEN_STATE}
              animate={COURSE_PREVIEW_VISIBLE_STATE}
              exit={COURSE_PREVIEW_HIDDEN_STATE}
              transition={COURSE_PREVIEW_TRANSITION}
              style={{ transformOrigin: "var(--radix-hover-card-content-transform-origin)" }}
            >
              <TrailCoursePreviewCard
                course={course}
                title={title}
                stateLabel={stateConfig.caption}
                isOpenable={isOpenable}
              />
            </motion.div>
          </HoverCardContent>
        )}
      </AnimatePresence>
    </HoverCard>
  );

  const stopClassName = "group relative z-10 flex flex-col items-center gap-3";
  const trailNodeControlClassName =
    "absolute z-20 grid size-7 place-items-center rounded-full bg-white text-neutral-500 opacity-0 shadow ring-1 ring-neutral-200 transition-opacity hover:text-neutral-900 focus-visible:opacity-100 group-hover/stop:opacity-100";

  return (
    <div
      className="group/stop relative"
      style={{ paddingTop: TRAIL_NODE_TOP }}
      data-testid={LEARNING_PATH_TRAIL_HANDLES.stop(course.courseId)}
      data-status={state}
      data-current={isCurrent}
      data-openable={isOpenable}
    >
      {isOpenable ? (
        <Link to={`/course/${course.courseId}`} className={stopClassName}>
          {nodeWithPreview}
          {label}
        </Link>
      ) : (
        <div
          className={stopClassName}
          title={isLocked ? t("learningPathsView.courseState.lockedDescription") : undefined}
        >
          {nodeWithPreview}
          {label}
        </div>
      )}

      {canManage && (
        <>
          <SortableList.DragHandle
            style={{
              top: TRAIL_NODE_CENTER_Y - TRAIL_NODE_CONTROL_SIZE / 2,
              left: `calc(50% - ${TRAIL_NODE_CONTROL_SIZE / 2}px)`,
            }}
            className={cn(trailNodeControlClassName, "cursor-grab active:cursor-grabbing")}
            aria-label={t("adminLearningPathsView.courses.drag")}
            data-testid={LEARNING_PATH_TRAIL_HANDLES.dragHandle(course.courseId)}
          >
            <GripVertical className="size-3.5" />
          </SortableList.DragHandle>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void onRemoveCourse(course.courseId)}
            style={{
              top: TRAIL_NODE_CONTROL_TOP,
              left: `calc(50% + ${TRAIL_NODE_CONTROL_OFFSET - TRAIL_NODE_CONTROL_SIZE / 2}px)`,
            }}
            className={cn(trailNodeControlClassName, "hover:text-error-600 disabled:opacity-50")}
            aria-label={t("adminLearningPathsView.courses.delete")}
            data-testid={LEARNING_PATH_TRAIL_HANDLES.removeButton(course.courseId)}
          >
            <X className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function TrailAddCourseStop({ isDisabled, onClick }: { isDisabled: boolean; onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      style={{ paddingTop: TRAIL_NODE_TOP }}
      data-testid={LEARNING_PATH_TRAIL_HANDLES.ADD_COURSE_BUTTON}
      className="group relative z-10 flex w-full flex-col items-center gap-3 text-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="grid size-[84px] shrink-0 place-items-center rounded-2xl border-[3px] border-dashed border-primary-300 bg-white text-primary-700 transition group-hover:border-primary-500 group-hover:bg-primary-50">
        <Plus className="size-6" />
      </span>
      <span className="text-sm font-semibold text-primary-700">
        {t("adminLearningPathsView.courses.add")}
      </span>
    </button>
  );
}

export function LearningPathTrail({
  courses,
  availableCourseOptions,
  canManage,
  canOpenCourses,
  showProgress,
  isPending,
  onAddCourses,
  onReorderCourses,
  onRemoveCourse,
}: LearningPathTrailProps) {
  const { t } = useTranslation();

  const [sortableCourses, setSortableCourses] = useState<SortableLearningPathCourse[]>(() =>
    mapToSortableCourses(courses),
  );
  const [isAddingCourses, setIsAddingCourses] = useState(false);

  useEffect(() => {
    setSortableCourses(mapToSortableCourses(courses));
  }, [courses]);

  const currentCourseId = findCurrentTrailCourse(courses)?.courseId;

  const { containerRef, columnCount } = useTrailColumnCount();
  const addCourseStopIndex = courses.length;
  const trailItemCount = courses.length + (canManage ? 1 : 0);

  const renderConnectorFrom = (index: number) => (
    <TrailConnector
      direction={getTrailConnectorDirection({
        index,
        itemCount: trailItemCount,
        columnCount,
      })}
      tone={getTrailConnectorTone({
        fromCourse: courses[index],
        toCourse: courses[index + 1],
        showProgress,
      })}
    />
  );

  const renderCourseStop = (course: SortableLearningPathCourse) => (
    <TrailCourseStop
      course={course}
      state={getTrailStopState({ course, showProgress })}
      isCurrent={showProgress && course.courseId === currentCourseId}
      canOpenCourse={canOpenCourses}
      canManage={canManage}
      isPending={isPending}
      onRemoveCourse={onRemoveCourse}
    />
  );

  const handleReorderCourses = async (items: SortableLearningPathCourse[]) => {
    setSortableCourses(items);

    try {
      await onReorderCourses(items.map((course) => course.courseId));
    } catch {
      setSortableCourses(mapToSortableCourses(courses));
    }
  };

  const trailCellClassName = "relative";
  const trailRowCount = Math.ceil(trailItemCount / columnCount);
  const hasLeftTurn = columnCount > 1 && trailRowCount > 2;

  return (
    <div className="flex flex-col gap-4">
      <div ref={containerRef} className="w-full" data-testid={LEARNING_PATH_TRAIL_HANDLES.TRAIL}>
        <div
          className={cn(
            "relative grid [&>.list-none]:absolute",
            hasLeftTurn ? "justify-center" : "justify-start",
          )}
          style={{
            gridTemplateColumns: `repeat(${columnCount}, ${TRAIL_CELL_WIDTH}px)`,
            gridAutoRows: TRAIL_ROW_HEIGHT,
          }}
        >
          {Array.from({ length: trailItemCount }, (_, index) => (
            <div
              key={`connector-${index}`}
              aria-hidden
              className="pointer-events-none relative"
              style={getTrailCellStyle(index, columnCount)}
            >
              {renderConnectorFrom(index)}
            </div>
          ))}

          {canManage ? (
            <SortableList
              items={sortableCourses}
              className="contents"
              onChange={(items) => {
                void handleReorderCourses(items as SortableLearningPathCourse[]);
              }}
              renderItem={(course, index) => (
                <SortableList.Item
                  id={course.sortableId}
                  className={trailCellClassName}
                  style={getTrailCellStyle(index, columnCount)}
                >
                  {renderCourseStop(course)}
                </SortableList.Item>
              )}
            />
          ) : (
            <ol className="contents">
              {courses.map((course, index) => (
                <li
                  key={course.id}
                  className={trailCellClassName}
                  style={getTrailCellStyle(index, columnCount)}
                >
                  {renderCourseStop({ ...course, sortableId: course.courseId })}
                </li>
              ))}
            </ol>
          )}

          {canManage && (
            <div
              className={trailCellClassName}
              style={getTrailCellStyle(addCourseStopIndex, columnCount)}
            >
              <TrailAddCourseStop
                isDisabled={!availableCourseOptions.length || isPending}
                onClick={() => setIsAddingCourses(true)}
              />
            </div>
          )}
        </div>
      </div>

      {!courses.length && !canManage && (
        <p className="text-sm text-neutral-500">{t("learningPathsView.detail.emptyCourses")}</p>
      )}

      {canManage && (
        <LearningPathAddCoursesDialog
          isOpen={isAddingCourses}
          courseOptions={availableCourseOptions}
          isPending={isPending}
          onClose={() => setIsAddingCourses(false)}
          onAddCourses={onAddCourses}
        />
      )}
    </div>
  );
}
