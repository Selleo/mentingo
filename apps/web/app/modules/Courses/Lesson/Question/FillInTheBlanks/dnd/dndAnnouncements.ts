import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";
import type { TFunction } from "i18next";

type DndLabelResolvers = {
  /** Human-readable name of a dragged word/target, by its draggable id. */
  getWordLabel: (activeId: string) => string;
  /** Human-readable name of a drop target (a blank, a pair, or the answer bank), by its id. */
  getBlankLabel: (overId: string) => string;
};

/**
 * Translated screen-reader instructions and announcements for the quiz drag paths, spelling out
 * the word text and blank/pair name instead of raw ids (WCAG 4.1.3). Shared by fill-in-the-blanks
 * and matching.
 */
export const buildDndAccessibility = (
  t: TFunction,
  { getWordLabel, getBlankLabel }: DndLabelResolvers,
): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } => ({
  screenReaderInstructions: { draggable: t("studentLessonView.other.dndInstructions") },
  announcements: {
    onDragStart: ({ active }) =>
      t("studentLessonView.other.dndOnStart", { word: getWordLabel(String(active.id)) }),
    onDragOver: ({ active, over }) =>
      over
        ? t("studentLessonView.other.dndOnOver", {
            word: getWordLabel(String(active.id)),
            blank: getBlankLabel(String(over.id)),
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("studentLessonView.other.dndOnEnd", {
            word: getWordLabel(String(active.id)),
            blank: getBlankLabel(String(over.id)),
          })
        : t("studentLessonView.other.dndOnCancel", { word: getWordLabel(String(active.id)) }),
    onDragCancel: ({ active }) =>
      t("studentLessonView.other.dndOnCancel", { word: getWordLabel(String(active.id)) }),
  },
});
