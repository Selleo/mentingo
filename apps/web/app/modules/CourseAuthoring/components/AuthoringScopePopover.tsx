/** Keeps target selection available on demand while showing the current scope in the toolbar. */
import { BookOpen, Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { stripHtmlTags } from "~/utils/stripHtmlTags";

import type { CourseContext } from "../courseAuthoring.types";

type Props = {
  course: CourseContext;
  selectedTargetIds: string[];
  selectedBlockIds: string[];
  disabled?: boolean;
  onSelectedTargetIdsChange: (ids: string[]) => void;
  onSelectedBlockIdsChange: (ids: string[]) => void;
};

/** Resolves known native lesson kinds and gives legacy values a neutral lesson label. */
const lessonTypeTranslationKey = (lessonType: string) => {
  switch (lessonType) {
    case "content":
    case "quiz":
    case "lesson":
      return lessonType;
    case "ai_mentor":
      return "aiMentor";
    default:
      return "lesson";
  }
};

/** Renders course, chapter, lesson, and block scope controls with parent-owned selection state. */
export const AuthoringScopePopover = ({
  course,
  selectedTargetIds,
  selectedBlockIds,
  disabled,
  onSelectedTargetIdsChange,
  onSelectedBlockIdsChange,
}: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>([]);
  const popupListenerRef = useRef<{
    element: HTMLDivElement;
    listener: () => void;
  } | null>(null);
  const selectedCount = selectedTargetIds.length + selectedBlockIds.length;
  const scopeLabel = selectedCount
    ? t("courseAuthoring.scope.selected", { count: selectedCount })
    : t("courseAuthoring.scope.entireCourse");

  /** Selects a chapter while removing all child lesson and block selections. */
  const toggleChapter = (
    chapterId: string,
    lessonIds: string[],
    blockIds: string[],
    checked: boolean,
  ) => {
    onSelectedTargetIdsChange(
      checked
        ? [
            ...selectedTargetIds.filter((id) => id !== chapterId && !lessonIds.includes(id)),
            chapterId,
          ]
        : selectedTargetIds.filter((id) => id !== chapterId),
    );
    if (checked) {
      onSelectedBlockIdsChange(selectedBlockIds.filter((id) => !blockIds.includes(id)));
    }
  };

  /** Selects one lesson while preserving sibling selections and removing its own blocks. */
  const toggleLesson = (
    chapterId: string,
    lessonId: string,
    blockIds: string[],
    checked: boolean,
  ) => {
    onSelectedTargetIdsChange(
      checked
        ? [...selectedTargetIds.filter((id) => id !== chapterId && id !== lessonId), lessonId]
        : selectedTargetIds.filter((id) => id !== lessonId),
    );
    if (checked) {
      onSelectedBlockIdsChange(selectedBlockIds.filter((id) => !blockIds.includes(id)));
    }
  };

  /** Selects a block and clears its parent entity target to keep the scope unambiguous. */
  const toggleBlock = (blockId: string, lessonId: string, chapterId: string, checked: boolean) => {
    if (checked) {
      onSelectedTargetIdsChange(
        selectedTargetIds.filter((id) => id !== chapterId && id !== lessonId),
      );
    }

    onSelectedBlockIdsChange(
      checked ? [...selectedBlockIds, blockId] : selectedBlockIds.filter((id) => id !== blockId),
    );
  };

  /** Registers on the portalled node as soon as it mounts so the drawer can delegate Escape. */
  const setPopupRef = useCallback((element: HTMLDivElement | null) => {
    const previous = popupListenerRef.current;
    previous?.element.removeEventListener("course-authoring-popup-escape", previous.listener);
    popupListenerRef.current = null;
    if (!element) return;
    const listener = () => setOpen(false);
    element.addEventListener("course-authoring-popup-escape", listener);
    popupListenerRef.current = { element, listener };
  }, []);

  useEffect(
    () => () => {
      const previous = popupListenerRef.current;
      previous?.element.removeEventListener("course-authoring-popup-escape", previous.listener);
      popupListenerRef.current = null;
    },
    [],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-w-52 gap-1.5 border-neutral-200 bg-white text-neutral-700 shadow-none hover:bg-primary-50 hover:text-primary-800"
          disabled={disabled}
          data-vaul-no-drag
          data-testid="course-authoring-scope-trigger"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Icon name="Target" className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{scopeLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="scrollbar-hide pointer-events-auto z-[70] max-h-[calc(100dvh-6rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto border-neutral-200 bg-white p-3 shadow-xl"
        ref={setPopupRef}
        data-course-authoring-popup
        data-vaul-no-drag
        onEscapeKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3">
          <p className="text-sm font-semibold text-neutral-900">
            {t("courseAuthoring.scope.choose")}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {t("courseAuthoring.scope.description")}
          </p>
        </div>
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
          onClick={() => {
            onSelectedTargetIdsChange([]);
            onSelectedBlockIdsChange([]);
            setOpen(false);
          }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <BookOpen className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">
              {t("courseAuthoring.scope.entireCourse")}
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              {t("courseAuthoring.scope.description")}
            </span>
          </span>
          {selectedCount === 0 && <Check className="size-4 shrink-0 text-primary-700" />}
        </button>
        {course.chapters.length === 0 ? (
          <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
            {t("courseAuthoring.scope.empty")}
          </p>
        ) : (
          <div className="scrollbar-hide max-h-80 space-y-2 overflow-y-auto pr-1">
            {course.chapters.map((chapter, chapterIndex) => {
              const chapterLessonIds = chapter.lessons.map((lesson) => lesson.id);
              const chapterBlockIds = chapter.lessons.flatMap((lesson) =>
                (lesson.blocks ?? []).map((block) => block.id),
              );
              const chapterNumber = chapter.displayOrder ?? chapterIndex;
              const chapterSelected = selectedTargetIds.includes(chapter.id);
              const expanded = expandedChapterIds.includes(chapter.id);
              return (
                <div
                  key={chapter.id}
                  className="overflow-hidden rounded-xl border border-neutral-200"
                >
                  <div className="flex items-center bg-white">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left hover:bg-neutral-50"
                      aria-pressed={chapterSelected}
                      onClick={() =>
                        toggleChapter(
                          chapter.id,
                          chapterLessonIds,
                          chapterBlockIds,
                          !chapterSelected,
                        )
                      }
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs font-semibold text-neutral-600">
                        {chapterNumber + 1}
                      </span>
                      <span
                        className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-medium text-neutral-900"
                        title={chapter.title}
                      >
                        {chapter.title}
                      </span>
                      {chapterSelected && <Check className="size-4 shrink-0 text-primary-700" />}
                    </button>
                    <button
                      type="button"
                      className="mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                      aria-label={chapter.title}
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedChapterIds((current) =>
                          expanded
                            ? current.filter((id) => id !== chapter.id)
                            : [...current, chapter.id],
                        )
                      }
                    >
                      <ChevronDown
                        className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                  {expanded && (
                    <div className="space-y-1 border-t border-neutral-100 bg-neutral-50 p-2">
                      {chapter.lessons.map((lesson) => {
                        const lessonSelected = selectedTargetIds.includes(lesson.id);
                        const parentSelected = chapterSelected;
                        return (
                          <div key={lesson.id}>
                            <button
                              type="button"
                              disabled={parentSelected}
                              aria-pressed={lessonSelected}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-neutral-700 hover:bg-white disabled:cursor-default disabled:opacity-50"
                              onClick={() =>
                                toggleLesson(
                                  chapter.id,
                                  lesson.id,
                                  (lesson.blocks ?? []).map((block) => block.id),
                                  !lessonSelected,
                                )
                              }
                            >
                              <span
                                className="line-clamp-2 min-w-0 flex-1 break-words font-medium"
                                title={lesson.title}
                              >
                                {lesson.title}
                              </span>
                              <span className="shrink-0 whitespace-nowrap text-[10px] uppercase text-neutral-400">
                                {t(
                                  `modernCourseView.contents.lessonTypes.${lessonTypeTranslationKey(lesson.lessonType)}`,
                                )}
                              </span>
                              {lessonSelected && (
                                <Check className="size-3.5 shrink-0 text-primary-700" />
                              )}
                            </button>
                            {!parentSelected &&
                              !lessonSelected &&
                              (lesson.blocks ?? []).map((block, blockIndex) => {
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
                                    className="ml-3 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-md px-3 py-1.5 text-left text-[11px] text-neutral-500 hover:bg-white"
                                    onClick={() =>
                                      toggleBlock(block.id, lesson.id, chapter.id, !blockSelected)
                                    }
                                  >
                                    <span
                                      className="min-w-0 flex-1 truncate"
                                      title={stripHtmlTags(block.html).trim() || undefined}
                                    >
                                      {t("courseAuthoring.scope.block", { number: blockIndex + 1 })}
                                      {" · "}
                                      {stripHtmlTags(block.html).trim().slice(0, 56) ||
                                        t("courseAuthoring.scope.untitled")}
                                    </span>
                                    {blockSelected && (
                                      <Check className="size-3 shrink-0 text-primary-700" />
                                    )}
                                  </button>
                                );
                              })}
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
      </PopoverContent>
    </Popover>
  );
};
