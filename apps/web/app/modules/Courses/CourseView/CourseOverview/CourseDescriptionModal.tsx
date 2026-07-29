import { Check, Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import { COURSE_SETTINGS_HANDLES } from "../../../../../e2e/data/courses/handles";
import { useCourseAccessProvider } from "../../context/CourseAccessProvider";

type CourseDescriptionModalProps = {
  courseDescription: string;
  onChangeDescription: (description: string) => void;
  onClose: () => void;
  onSaveDescription: () => Promise<void>;
};

export default function CourseDescriptionModal({
  courseDescription,
  onChangeDescription,
  onClose,
  onSaveDescription,
}: CourseDescriptionModalProps) {
  const { course, isAdminExperience } = useCourseAccessProvider();
  const { t } = useTranslation();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl"
        noCloseButton
        aria-describedby={undefined}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between md:mb-6">
            <DialogTitle className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
              {t("modernCourseView.overview.aboutCourse")}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("modernCourseView.overview.closeDetails")}
              onClick={onClose}
              className="rounded-full"
            >
              <X className="size-5 text-neutral-800" />
            </Button>
          </div>

          <div className="mb-6">
            <h4 className="mb-2 text-xl font-bold text-neutral-950">{course.title}</h4>
            <div className="flex items-center gap-2 text-sm text-neutral-800">
              <span className="rounded-full bg-primary-50 px-3 py-1 font-semibold text-primary-700">
                {course.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-4" />
                {formatDuration(course.estimatedDurationSeconds, t)}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h5 className="mb-3 font-bold text-neutral-950">
              {t("modernCourseView.overview.description")}
            </h5>
            {isAdminExperience ? (
              <textarea
                data-testid={COURSE_SETTINGS_HANDLES.DESCRIPTION_EDITOR}
                value={courseDescription}
                onChange={(event) => onChangeDescription(event.target.value)}
                className="min-h-32 w-full rounded-lg border-2 border-neutral-200 p-3 leading-relaxed text-neutral-950 focus:border-primary-700 focus:outline-none"
                placeholder={t("modernCourseView.overview.descriptionPlaceholder")}
                onBlur={() => void onSaveDescription()}
              />
            ) : (
              <p className="leading-relaxed text-neutral-800">{course.description}</p>
            )}
          </div>

          {course.learningOutcomes && course.learningOutcomes.length > 0 && (
            <div className="mb-6">
              <h5 className="mb-4 text-lg font-bold text-neutral-950">
                {t("modernCourseView.overview.whatYouWillMaster")}
              </h5>
              <ul className="space-y-3">
                {course.learningOutcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-success-500 text-success-500">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="text-lg font-medium leading-relaxed text-neutral-800">
                      {outcome}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              onClick={onClose}
              className="px-6 font-semibold"
            >
              {t("modernCourseView.common.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
