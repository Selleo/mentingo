import { Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "~/modules/Courses/utils/formatDuration";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("modernCourseView.overview.closeDetails")}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="p-4 md:p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between md:mb-6">
            <h3 className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
              {t("modernCourseView.overview.aboutCourse")}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-neutral-100"
            >
              <X className="h-5 w-5 text-neutral-800" />
            </button>
          </div>

          <div className="mb-6">
            <h4 className="mb-2 text-xl font-bold text-neutral-950">{course.title}</h4>
            <div className="flex items-center gap-2 text-sm text-neutral-800">
              <span className="rounded-full bg-primary-50 px-3 py-1 font-semibold text-primary-700">
                {course.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(course.estimatedDurationSeconds)}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h5 className="mb-3 font-bold text-neutral-950">
              {t("modernCourseView.overview.description")}
            </h5>
            {isAdminExperience ? (
              <textarea
                value={courseDescription}
                onChange={(event) => onChangeDescription(event.target.value)}
                className="min-h-[120px] w-full rounded-lg border-2 border-neutral-200 p-3 leading-relaxed text-neutral-950 focus:border-primary-700 focus:outline-none"
                placeholder={t("modernCourseView.overview.descriptionPlaceholder")}
                onBlur={() => void onSaveDescription()}
              />
            ) : (
              <p className="leading-relaxed text-neutral-800">{course.description}</p>
            )}
          </div>

          <div className="mb-6">
            <h5 className="mb-3 font-bold text-neutral-950">
              {t("modernCourseView.overview.whatYouWillLearn")}
            </h5>
            <div className="space-y-2" />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary-700 px-6 py-2 font-semibold text-white transition-colors hover:bg-primary-800"
            >
              {t("modernCourseView.common.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
