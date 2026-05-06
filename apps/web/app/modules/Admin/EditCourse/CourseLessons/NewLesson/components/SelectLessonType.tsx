import { PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

import {
  CURRICULUM_HANDLES,
  LESSON_TYPE_OPTION_HANDLES,
} from "../../../../../../../e2e/data/curriculum/handles";
import { ContentTypes } from "../../../EditCourse.types";

import type { LessonIcons } from "../../../EditCourse.types";
import type { LucideIcon } from "lucide-react";

type SelectLessonTypeProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
};

type LessonTypeHandle = Parameters<typeof CURRICULUM_HANDLES.lessonTypeOption>[0];

type LessonTypeConfig = {
  contentType: string;
  handle: LessonTypeHandle;
  title: string;
  description: string;
  icon?: LessonIcons;
  lucideIcon?: LucideIcon;
};

const lessonTypes: readonly LessonTypeConfig[] = [
  {
    contentType: ContentTypes.CONTENT_LESSON_FORM,
    handle: LESSON_TYPE_OPTION_HANDLES.CONTENT,
    icon: "Content",
    title: "adminCourseView.curriculum.lesson.other.content",
    description: "adminCourseView.curriculum.lesson.other.contentLessonDescription",
  },
  {
    contentType: ContentTypes.QUIZ_FORM,
    handle: LESSON_TYPE_OPTION_HANDLES.QUIZ,
    icon: "Quiz",
    title: "adminCourseView.curriculum.lesson.other.quiz",
    description: "adminCourseView.curriculum.lesson.other.quizLessonDescription",
  },
  {
    contentType: ContentTypes.EMBED_FORM,
    handle: LESSON_TYPE_OPTION_HANDLES.EMBED,
    icon: "Embed",
    title: "adminCourseView.curriculum.lesson.other.embed",
    description: "adminCourseView.curriculum.lesson.other.embedLessonDescription",
  },
  {
    contentType: ContentTypes.AI_MENTOR_FORM,
    handle: LESSON_TYPE_OPTION_HANDLES.AI_MENTOR,
    icon: "AiMentor",
    title: "adminCourseView.curriculum.lesson.other.aiMentor",
    description: "adminCourseView.curriculum.lesson.other.aiMentorLessonDescription",
  },
  {
    contentType: ContentTypes.SCORM_LESSON_FORM,
    handle: LESSON_TYPE_OPTION_HANDLES.SCORM,
    lucideIcon: PackageOpen,
    title: "adminCourseView.curriculum.lesson.other.scorm",
    description: "adminCourseView.curriculum.lesson.other.scormLessonDescription",
  },
];

const SelectLessonType = ({ setContentTypeToDisplay }: SelectLessonTypeProps) => {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-y-6 bg-white p-8">
        <h3 className="h5 text-neutral-950">
          {t("adminCourseView.curriculum.lesson.other.chooseType")}:
        </h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4">
          {lessonTypes.map(
            ({ contentType, handle, icon, lucideIcon: LucideIcon, title, description }) => {
              return (
                <div
                  key={handle}
                  data-testid={CURRICULUM_HANDLES.lessonTypeOption(handle)}
                  className="flex flex-col gap-y-6 rounded-lg border border-neutral-200 px-6 py-4 hover:border-primary-500"
                  role="button"
                  onClick={() => setContentTypeToDisplay(contentType)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setContentTypeToDisplay(contentType);
                    }
                  }}
                  tabIndex={0}
                  aria-label={t(
                    "adminCourseView.curriculum.lesson.other.chooseLessonTypeAriaLabel",
                    {
                      type: t(title),
                    },
                  )}
                >
                  {LucideIcon ? (
                    <LucideIcon className="mb-6 size-8 text-primary-700" aria-hidden="true" />
                  ) : icon ? (
                    <Icon name={icon} className="mb-6 size-8 text-primary-700" />
                  ) : null}
                  <hgroup className="space-y-3">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <h3 className="h6 text-neutral-950">{t(title)}</h3>
                      {contentType === ContentTypes.AI_MENTOR_FORM && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="uppercase">
                              Beta
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            {t("adminCourseView.curriculum.lesson.other.betaTooltip")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="body-sm text-neutral-800">{t(description)}</p>
                  </hgroup>
                </div>
              );
            },
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SelectLessonType;
