import { LESSON_TYPES } from "@repo/shared";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { formatWithPlural } from "~/lib/utils";
import { ChapterCounter } from "~/modules/Courses/CourseView/components/ChapterCounter";
import { LessonTypeIcon } from "~/modules/Courses/CourseView/LessonTypeIcon";
import { getLessonTypeTranslationKey } from "~/modules/Courses/CourseView/lessonTypes";

import type { LessonTypes } from "@repo/shared";
import type { GetContentMarketplaceListingOutlineResponse } from "~/api/generated-api";

type OutlineChapter = GetContentMarketplaceListingOutlineResponse["data"]["chapters"][number];
type OutlineLesson = OutlineChapter["lessons"][number];

type ContentMarketplacePreviewChapterProps = {
  chapter: OutlineChapter;
  displayOrder: number;
  isLastChapter: boolean;
};

const LESSON_TYPE_VALUES: readonly string[] = Object.values(LESSON_TYPES);

const isKnownLessonType = (type: string): type is LessonTypes => LESSON_TYPE_VALUES.includes(type);

/** A chapter of the course overview as a read-only outline: lessons are listed but cannot be opened. */
export function ContentMarketplacePreviewChapter({
  chapter,
  displayOrder,
  isLastChapter,
}: ContentMarketplacePreviewChapterProps) {
  const { t } = useTranslation();
  const quizCount = chapter.lessons.filter((lesson) => lesson.type === LESSON_TYPES.QUIZ).length;
  const lessonText = formatWithPlural(
    chapter.lessons.length - quizCount,
    t("courseChapterView.other.lesson"),
    t("courseChapterView.other.lessons"),
  );
  const quizText = formatWithPlural(
    quizCount,
    t("courseChapterView.other.quiz"),
    t("courseChapterView.other.quizzes"),
  );

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value={String(displayOrder)}>
        <div className="flex w-full gap-x-4">
          <ChapterCounter
            chapterProgress={undefined}
            displayOrder={displayOrder}
            isLastChapter={isLastChapter}
            isPreviewMode
          />
          <div className="flex w-full min-w-0 flex-col">
            <AccordionTrigger className="border text-start data-[state=closed]:rounded-lg data-[state=open]:rounded-t-lg data-[state=open]:border-primary-500 data-[state=open]:bg-primary-50 [&[data-state=open]>div>div>svg]:rotate-180 [&[data-state=open]>div>div>svg]:duration-200 [&[data-state=open]>div>div>svg]:ease-out">
              <div className="flex w-full items-center gap-x-1 px-2 py-4 md:gap-x-4 md:p-4">
                <div className="grid size-8 shrink-0 place-items-center">
                  <Icon name="CarretDownLarge" className="h-auto w-6 text-accent-foreground" />
                </div>
                <div className="flex w-full min-w-0 flex-col">
                  <div className="details text-neutral-800">
                    {lessonText} {lessonText && quizText ? "• " : ""} {quizText}
                  </div>
                  <p className="body-base-md break-words text-neutral-950">{chapter.title}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="divide-y divide-neutral-200 rounded-b-lg border-x border-b border-primary-500 pb-4 pl-14 pr-4 pt-3">
                {chapter.lessons.map((lesson, lessonIndex) => (
                  <PreviewLesson key={lessonIndex} lesson={lesson} />
                ))}
              </ul>
            </AccordionContent>
          </div>
        </div>
      </AccordionItem>
    </Accordion>
  );
}

function PreviewLesson({ lesson }: { lesson: OutlineLesson }) {
  const { t } = useTranslation();
  const lessonType = isKnownLessonType(lesson.type) ? lesson.type : null;
  const lessonTypeLabel = lessonType
    ? t(getLessonTypeTranslationKey(lessonType), { defaultValue: lessonType })
    : lesson.type;

  return (
    <li className="flex w-full gap-x-2 p-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="size-6 shrink-0" role="img" aria-label={lessonTypeLabel}>
              {lessonType ? (
                <LessonTypeIcon type={lessonType} className="size-6 text-accent-foreground" />
              ) : (
                <FileText className="size-6 text-accent-foreground" aria-hidden />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>{lessonTypeLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <p className="body-sm-md flex-1 self-center break-words text-neutral-950">{lesson.title}</p>
    </li>
  );
}
