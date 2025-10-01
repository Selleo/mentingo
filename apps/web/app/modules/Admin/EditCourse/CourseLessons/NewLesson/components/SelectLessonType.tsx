import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

import { ContentTypes } from "../../../EditCourse.types";

import type { LessonIcons } from "../../../EditCourse.types";

type SelectLessonTypeProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
};

const lessonTypes = [
  {
    type: ContentTypes.TEXT_LESSON_FORM,
    icon: "Text",
    title: "adminCourseView.curriculum.lesson.other.text",
    description: "adminCourseView.curriculum.lesson.other.textLessonDescription",
  },
  {
    type: ContentTypes.VIDEO_LESSON_FORM,
    icon: "Video",
    title: "adminCourseView.curriculum.lesson.other.video",
    description: "adminCourseView.curriculum.lesson.other.videoLessonDescription",
  },
  {
    type: ContentTypes.PRESENTATION_FORM,
    icon: "Presentation",
    title: "adminCourseView.curriculum.lesson.other.presentation",
    description: "adminCourseView.curriculum.lesson.other.presentationLessonDescription",
  },
  {
    type: ContentTypes.QUIZ_FORM,
    icon: "Quiz",
    title: "adminCourseView.curriculum.lesson.other.quiz",
    description: "adminCourseView.curriculum.lesson.other.quizLessonDescription",
  },
  {
    type: ContentTypes.EMBED_FORM,
    icon: "Embed",
    title: "adminCourseView.curriculum.lesson.other.embed",
    description: "adminCourseView.curriculum.lesson.other.embedLessonDescription",
  },
  {
    type: ContentTypes.AI_MENTOR_FORM,
    icon: "AiMentor",
    title: "adminCourseView.curriculum.lesson.other.aiMentor",
    description: "adminCourseView.curriculum.lesson.other.aiMentorLessonDescription",
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {lessonTypes.map(({ type, icon, title, description }) => {
            return (
              <div
                key={type}
                className="flex flex-col gap-y-6 rounded-lg border border-neutral-200 px-6 py-4 hover:border-primary-500"
                role="button"
                onClick={() => setContentTypeToDisplay(type)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setContentTypeToDisplay(type);
                  }
                }}
                tabIndex={0}
                aria-label={`Choose ${title} lesson type`}
              >
                <Icon name={icon as LessonIcons} className="mb-6 size-8 text-primary-700" />
                <hgroup className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <h3 className="h6 text-neutral-950">{t(title)}</h3>
                    {type === ContentTypes.AI_MENTOR_FORM && (
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
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SelectLessonType;
