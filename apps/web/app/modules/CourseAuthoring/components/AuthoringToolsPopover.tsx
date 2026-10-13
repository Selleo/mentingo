import { COURSE_AUTHORING_SOURCE_FILE_TYPES, MAX_COURSE_AUTHORING_SOURCE_SIZE } from "@repo/shared";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  FileUp,
  Globe2,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import { COURSE_AUTHORING_HANDLES } from "../../../../e2e/data/curriculum/handles";

import { SourceRefreshPanel } from "./SourceRefreshPanel";

import type {
  CourseContext,
  SourcePolicy,
  SourceRefreshView,
  SourceView,
} from "../courseAuthoring.types";

type Props = {
  course: CourseContext;
  policy: SourcePolicy;
  strictSourceMode: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isUploadingSource?: boolean;
  sourceUploadError?: string | null;
  sourceSelectionError?: string | null;
  selectedTargetIds: string[];
  selectedBlockIds: string[];
  sources: SourceView[];
  sourceRefreshes: SourceRefreshView[];
  onPolicyChange: (policy: SourcePolicy) => void;
  onStrictSourceModeChange: (enabled: boolean) => void;
  onUploadSource?: (file: File) => void | Promise<string | void>;
  onSourceUploadError?: (error: string | null) => void;
  onSelectedTargetIdsChange: (ids: string[]) => void;
  onSelectedBlockIdsChange: (ids: string[]) => void;
  onRefreshSource?: (
    oldSourceVersionId: string,
    replacementSourceVersionId: string,
    sourcePolicy?: SourcePolicy,
    selectedTaskIds?: string[],
  ) => void;
};

const AUTHORING_SOURCE_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;
const AUTHORING_SOURCE_ACCEPT = [
  ...COURSE_AUTHORING_SOURCE_FILE_TYPES,
  ...AUTHORING_SOURCE_EXTENSIONS,
].join(",");

const sourceError = (file: File): string | null => {
  if (file.size > MAX_COURSE_AUTHORING_SOURCE_SIZE) return "courseAuthoring.sources.tooLarge";
  const lowerName = file.name.toLowerCase();
  const validMime = COURSE_AUTHORING_SOURCE_FILE_TYPES.some((type) => type === file.type);
  const validExtension = AUTHORING_SOURCE_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );
  return validMime || validExtension ? null : "courseAuthoring.sources.unsupportedFile";
};

const lessonTypeLabel = (lessonType: string) => {
  switch (lessonType) {
    case "ai_mentor":
      return "aiMentor";
    case "content":
    case "quiz":
    case "lesson":
      return lessonType;
    default:
      return "lesson";
  }
};

const SCOPE_ROW_CLASS =
  "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 disabled:opacity-60 disabled:hover:bg-transparent";

const ScopeCheck = ({
  checked,
  inherited = false,
  compact = false,
}: {
  checked: boolean;
  inherited?: boolean;
  compact?: boolean;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex shrink-0 items-center justify-center rounded border transition-colors",
      compact ? "size-3.5" : "size-4",
      checked && "border-primary-600 bg-primary-600 text-white",
      inherited && "border-primary-300 bg-primary-100 text-primary-600",
      !checked && !inherited && "border-neutral-300 bg-white text-transparent",
    )}
  >
    <Check className={compact ? "size-2.5" : "size-3"} strokeWidth={3} />
  </span>
);

export const TOOLS_VIEW = { ROOT: "root", SCOPE: "scope" } as const;
type ToolsView = (typeof TOOLS_VIEW)[keyof typeof TOOLS_VIEW];

const VIEW_WIDTH_PX: Record<ToolsView, number> = {
  [TOOLS_VIEW.ROOT]: 320,
  [TOOLS_VIEW.SCOPE]: 448,
};

const viewWidth = (view: ToolsView) =>
  typeof window === "undefined"
    ? VIEW_WIDTH_PX[view]
    : Math.min(VIEW_WIDTH_PX[view], window.innerWidth - 32);

const MENU_ROW_CLASS =
  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-primary-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50";

const MenuIcon = ({ children }: { children: ReactNode }) => (
  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
    {children}
  </span>
);

const ToggleRow = ({
  icon,
  label,
  help,
  checked,
  disabled,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className="flex min-h-10 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    aria-pressed={checked}
    onClick={onToggle}
  >
    <span className={cn("shrink-0", checked ? "text-primary-700" : "text-neutral-500")}>
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm text-neutral-900">{label}</span>
      {help && <span className="block truncate text-xs text-neutral-500">{help}</span>}
    </span>
    <span
      aria-hidden="true"
      className={cn(
        "relative h-[18px] w-8 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary-600" : "bg-neutral-200",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </span>
  </button>
);

type ScopeViewProps = Pick<
  Props,
  | "course"
  | "selectedTargetIds"
  | "selectedBlockIds"
  | "onSelectedTargetIdsChange"
  | "onSelectedBlockIdsChange"
> & { onBack: () => void };

/** Keeps the scope hierarchy compact while preserving chapter, lesson, and block semantics. */
const ScopeView = ({
  course,
  selectedTargetIds,
  selectedBlockIds,
  onSelectedTargetIdsChange,
  onSelectedBlockIdsChange,
  onBack,
}: ScopeViewProps) => {
  const { t } = useTranslation();
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>([]);

  const toggleChapter = (chapterId: string, lessonIds: string[], blockIds: string[]) => {
    const selected = selectedTargetIds.includes(chapterId);
    onSelectedTargetIdsChange(
      selected
        ? selectedTargetIds.filter((id) => id !== chapterId)
        : [
            ...selectedTargetIds.filter((id) => id !== chapterId && !lessonIds.includes(id)),
            chapterId,
          ],
    );
    if (!selected) {
      onSelectedBlockIdsChange(selectedBlockIds.filter((id) => !blockIds.includes(id)));
    }
  };

  const toggleLesson = (chapterId: string, lessonId: string, blockIds: string[]) => {
    const selected = selectedTargetIds.includes(lessonId);
    onSelectedTargetIdsChange(
      selected
        ? selectedTargetIds.filter((id) => id !== lessonId)
        : [...selectedTargetIds.filter((id) => id !== chapterId && id !== lessonId), lessonId],
    );
    if (!selected)
      onSelectedBlockIdsChange(selectedBlockIds.filter((id) => !blockIds.includes(id)));
  };

  const toggleBlock = (blockId: string, lessonId: string, chapterId: string) => {
    const selected = selectedBlockIds.includes(blockId);
    if (!selected) {
      onSelectedTargetIdsChange(
        selectedTargetIds.filter((id) => id !== chapterId && id !== lessonId),
      );
    }
    onSelectedBlockIdsChange(
      selected ? selectedBlockIds.filter((id) => id !== blockId) : [...selectedBlockIds, blockId],
    );
  };

  const selectionCount = selectedTargetIds.length + selectedBlockIds.length;

  return (
    <div className="max-h-[min(32rem,80dvh)] min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-white px-2 pb-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700"
          aria-label={t("courseAuthoring.tools.back")}
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-950">
            {t("courseAuthoring.scope.choose")}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {selectionCount === 0
              ? t("courseAuthoring.tools.scopeWholeCourse")
              : t("courseAuthoring.tools.scopeSelectedCount", { count: selectionCount })}
          </p>
        </div>
        {selectionCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 rounded-lg px-2 text-xs text-neutral-600 hover:bg-primary-50 hover:text-primary-700"
            onClick={() => {
              onSelectedTargetIdsChange([]);
              onSelectedBlockIdsChange([]);
            }}
          >
            {t("courseAuthoring.tools.clearScope")}
          </Button>
        )}
      </div>
      {course.chapters.length === 0 ? (
        <p className="mx-2 mb-2 rounded-lg border border-dashed border-neutral-200 p-3 text-xs text-neutral-600">
          {t("courseAuthoring.scope.empty")}
        </p>
      ) : (
        <div
          data-testid="course-authoring-scope-list"
          className="space-y-1 border-t border-neutral-100 p-2"
        >
          {course.chapters.map((chapter, chapterIndex) => {
            const lessonIds = chapter.lessons.map((lesson) => lesson.id);
            const blockIds = chapter.lessons.flatMap((lesson) =>
              (lesson.blocks ?? []).map((block) => block.id),
            );
            const selected = selectedTargetIds.includes(chapter.id);
            const expanded = expandedChapterIds.includes(chapter.id);
            const chapterNumber = chapter.displayOrder ?? chapterIndex;
            const innerCount =
              chapter.lessons.filter((lesson) => selectedTargetIds.includes(lesson.id)).length +
              blockIds.filter((id) => selectedBlockIds.includes(id)).length;
            return (
              <div key={chapter.id}>
                <div
                  className={cn(
                    "flex items-center rounded-lg pr-1 transition-colors",
                    selected ? "bg-primary-50 hover:bg-primary-100/70" : "hover:bg-neutral-100",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={cn(SCOPE_ROW_CLASS, "h-12 hover:bg-transparent")}
                    onClick={() => toggleChapter(chapter.id, lessonIds, blockIds)}
                  >
                    <ScopeCheck checked={selected} />
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-neutral-600 ring-1 ring-inset ring-neutral-200">
                      {chapterNumber + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium text-neutral-900"
                        title={chapter.title}
                      >
                        {chapter.title}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {t("courseAuthoring.scope.lessonCount", { count: chapter.lessons.length })}
                        {!selected && innerCount > 0 && (
                          <span className="text-primary-700">
                            {" · "}
                            {t("courseAuthoring.scope.innerSelected", { count: innerCount })}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={chapter.title}
                    aria-expanded={expanded}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    onClick={() =>
                      setExpandedChapterIds((current) =>
                        expanded
                          ? current.filter((id) => id !== chapter.id)
                          : [...current, chapter.id],
                      )
                    }
                  >
                    <ChevronDown
                      className={cn("size-4 transition-transform", expanded && "rotate-180")}
                    />
                  </button>
                </div>
                {expanded && (
                  <div className="ml-5 space-y-0.5 border-l border-neutral-200 pb-1.5 pl-2 pr-1">
                    {chapter.lessons.map((lesson) => {
                      const lessonSelected = selectedTargetIds.includes(lesson.id);
                      const parentSelected = selected;
                      return (
                        <div key={lesson.id}>
                          <button
                            type="button"
                            disabled={parentSelected}
                            aria-pressed={lessonSelected}
                            className={cn(
                              SCOPE_ROW_CLASS,
                              "h-9 w-full py-0 disabled:cursor-default",
                            )}
                            onClick={() =>
                              toggleLesson(
                                chapter.id,
                                lesson.id,
                                (lesson.blocks ?? []).map((block) => block.id),
                              )
                            }
                          >
                            <ScopeCheck checked={lessonSelected} inherited={parentSelected} />
                            <span
                              className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-800"
                              title={lesson.title}
                            >
                              {lesson.title}
                            </span>
                            <span className="w-16 shrink-0 truncate rounded bg-white px-1.5 py-0.5 text-center text-[10px] font-medium text-neutral-500 ring-1 ring-inset ring-neutral-200">
                              {t(
                                `modernCourseView.contents.lessonTypes.${lessonTypeLabel(lesson.lessonType)}`,
                              )}
                            </span>
                          </button>
                          {!parentSelected &&
                            !lessonSelected &&
                            (lesson.blocks ?? []).length > 0 && (
                              <div className="ml-4 space-y-0.5 border-l border-dashed border-neutral-200 pl-2">
                                {(lesson.blocks ?? []).map((block, blockIndex) => {
                                  const blockSelected = selectedBlockIds.includes(block.id);
                                  return (
                                    <button
                                      type="button"
                                      key={block.id}
                                      aria-label={t("courseAuthoring.scope.selectBlock", {
                                        number: blockIndex + 1,
                                        title: lesson.title,
                                      })}
                                      aria-pressed={blockSelected}
                                      className={cn(SCOPE_ROW_CLASS, "h-8 w-full py-0")}
                                      onClick={() => toggleBlock(block.id, lesson.id, chapter.id)}
                                    >
                                      <ScopeCheck checked={blockSelected} compact />
                                      <span className="w-12 shrink-0 text-[11px] font-medium text-neutral-500">
                                        {t("courseAuthoring.scope.block", {
                                          number: blockIndex + 1,
                                        })}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500">
                                        {stripHtmlTags(block.html).trim().slice(0, 64) ||
                                          t("courseAuthoring.scope.untitled")}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Hosts the single anchored tools menu and keeps source, scope, and thinking controls together. */
export const AuthoringToolsPopover = ({
  course,
  policy,
  strictSourceMode,
  disabled,
  open: controlledOpen,
  onOpenChange,
  isUploadingSource = false,
  sourceUploadError,
  sourceSelectionError,
  selectedTargetIds,
  selectedBlockIds,
  sources,
  sourceRefreshes,
  onPolicyChange,
  onStrictSourceModeChange,
  onUploadSource,
  onSourceUploadError,
  onSelectedTargetIdsChange,
  onSelectedBlockIdsChange,
  onRefreshSource,
}: Props) => {
  const { t } = useTranslation();
  const inputId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [view, setView] = useState<ToolsView>(TOOLS_VIEW.ROOT);
  const [drawerPortalContainer, setDrawerPortalContainer] = useState<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const popupListenerRef = useRef<{ element: HTMLDivElement; listener: () => void } | null>(null);
  const selectedCount = selectedTargetIds.length + selectedBlockIds.length;
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const setPopupRef = useCallback(
    (element: HTMLDivElement | null) => {
      const previous = popupListenerRef.current;
      previous?.element.removeEventListener("course-authoring-popup-escape", previous.listener);
      popupListenerRef.current = null;
      if (!element) return;
      const listener = () => setOpen(false);
      element.addEventListener("course-authoring-popup-escape", listener);
      popupListenerRef.current = { element, listener };
    },
    [setOpen],
  );

  const setTriggerRef = useCallback((element: HTMLButtonElement | null) => {
    setDrawerPortalContainer(element?.closest<HTMLElement>("[data-vaul-drawer]") ?? null);
  }, []);

  useEffect(
    () => () => {
      const previous = popupListenerRef.current;
      previous?.element.removeEventListener("course-authoring-popup-escape", previous.listener);
    },
    [],
  );

  useEffect(() => {
    if (!open) setView(TOOLS_VIEW.ROOT);
  }, [open]);

  const handleFileChange = (file: File | undefined, reset: () => void) => {
    if (file) {
      const error = sourceError(file);
      onSourceUploadError?.(error);
      if (!error) void onUploadSource?.(file);
    }
    reset();
  };

  const updatePolicy = (next: SourcePolicy) => onPolicyChange(next);
  const toggleStrict = (enabled: boolean) => {
    onStrictSourceModeChange(enabled);
    updatePolicy({
      ...policy,
      webEnabled: enabled ? false : policy.webEnabled,
      generalKnowledgeEnabled: enabled ? false : true,
    });
  };
  const toggleWebSearch = () => {
    const webEnabled = !policy.webEnabled;
    if (strictSourceMode && webEnabled) onStrictSourceModeChange(false);
    updatePolicy({
      ...policy,
      webEnabled,
      ...(strictSourceMode && webEnabled ? { generalKnowledgeEnabled: true } : {}),
    });
  };
  const toggleDeepThinking = () =>
    updatePolicy({
      ...policy,
      researchDepth: policy.researchDepth === "deep" ? "standard" : "deep",
    });

  const width = viewWidth(view);
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.8 };
  const direction = view === TOOLS_VIEW.SCOPE ? 1 : -1;

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={setTriggerRef}
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-neutral-700 hover:bg-primary-50 hover:text-primary-700 data-[state=open]:bg-primary-50 data-[state=open]:text-primary-700"
          disabled={disabled}
          aria-label={t("courseAuthoring.tools.open")}
          data-testid={COURSE_AUTHORING_HANDLES.TOOLS_TRIGGER}
          data-vaul-no-drag
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Plus
            className="size-5 transition-transform duration-200 [[data-state=open]>&]:rotate-45"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={setPopupRef}
        portalContainer={drawerPortalContainer}
        align="start"
        sideOffset={8}
        data-course-authoring-popup
        data-vaul-no-drag
        className="pointer-events-auto z-[70] w-auto min-h-0 overflow-hidden rounded-xl border-neutral-200 bg-white p-0 shadow-xl"
        onEscapeKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <motion.div
          data-course-authoring-view
          className="relative min-h-0 overflow-hidden"
          layout="size"
          initial={false}
          animate={{ width }}
          transition={transition}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={view}
              custom={direction}
              style={{ width }}
              initial={shouldReduceMotion ? false : { opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: direction * -24 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }
              }
            >
              {view === TOOLS_VIEW.SCOPE ? (
                <ScopeView
                  course={course}
                  selectedTargetIds={selectedTargetIds}
                  selectedBlockIds={selectedBlockIds}
                  onSelectedTargetIdsChange={onSelectedTargetIdsChange}
                  onSelectedBlockIdsChange={onSelectedBlockIdsChange}
                  onBack={() => setView(TOOLS_VIEW.ROOT)}
                />
              ) : (
                <div className="p-1.5">
                  {sourceSelectionError && (
                    <p
                      role="alert"
                      aria-label={sourceSelectionError}
                      className="m-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"
                    >
                      {sourceSelectionError}
                    </p>
                  )}
                  <label
                    htmlFor={inputId}
                    className={cn(
                      MENU_ROW_CLASS,
                      "cursor-pointer focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-500",
                      (disabled || isUploadingSource) && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <MenuIcon>
                      <FileUp className="size-4" aria-hidden="true" />
                    </MenuIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-neutral-900">
                        {t("courseAuthoring.tools.attachFiles")}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {t("courseAuthoring.sources.fileHint")}
                      </span>
                    </span>
                    <input
                      id={inputId}
                      type="file"
                      className="sr-only"
                      accept={AUTHORING_SOURCE_ACCEPT}
                      disabled={disabled || isUploadingSource}
                      onChange={(event) =>
                        handleFileChange(event.target.files?.[0], () => {
                          event.currentTarget.value = "";
                        })
                      }
                    />
                  </label>
                  {sourceUploadError && (
                    <p role="alert" className="mx-2 mb-1 text-xs text-destructive">
                      {t(sourceUploadError)}
                    </p>
                  )}
                  <button
                    type="button"
                    className={MENU_ROW_CLASS}
                    onClick={() => setView(TOOLS_VIEW.SCOPE)}
                  >
                    <MenuIcon>
                      <SlidersHorizontal className="size-4" aria-hidden="true" />
                    </MenuIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-neutral-900">
                        {t("courseAuthoring.tools.scope")}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {selectedCount === 0
                          ? t("courseAuthoring.tools.scopeWholeCourse")
                          : t("courseAuthoring.tools.scopeSelectedCount", { count: selectedCount })}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  </button>
                  <p className="px-2.5 pb-1.5 pt-3 text-xs font-medium text-neutral-500">
                    {t("courseAuthoring.tools.aiSection")}
                  </p>
                  <div className="mx-1 mb-1 divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
                    <ToggleRow
                      icon={<Globe2 className="size-4" aria-hidden="true" />}
                      label={t("courseAuthoring.tools.webSearch")}
                      checked={policy.webEnabled}
                      disabled={disabled}
                      onToggle={toggleWebSearch}
                    />
                    <ToggleRow
                      icon={<Brain className="size-4" aria-hidden="true" />}
                      label={t("courseAuthoring.tools.deepThinking")}
                      checked={policy.researchDepth === "deep"}
                      disabled={disabled}
                      onToggle={toggleDeepThinking}
                    />
                    <ToggleRow
                      icon={<FileText className="size-4" aria-hidden="true" />}
                      label={t("courseAuthoring.tools.strictSourceMode")}
                      help={t("courseAuthoring.tools.strictSourceModeHelp")}
                      checked={strictSourceMode}
                      disabled={disabled}
                      onToggle={() => toggleStrict(!strictSourceMode)}
                    />
                  </div>
                  {onRefreshSource && sourceRefreshes[0]?.status === "needs_mapping" && (
                    <div className="mt-1.5 border-t border-neutral-100 px-1 pt-2">
                      <SourceRefreshPanel
                        sourceRefreshes={sourceRefreshes}
                        sources={sources}
                        sourcePolicy={policy}
                        course={course}
                        disabled={disabled}
                        onRefreshSource={onRefreshSource}
                      />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
};
