import { Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseDescriptionModalProps = {
  course: GetCourseResponse["data"];
  courseDescription: string;
  courseTitle: string;
  isAdminExperience: boolean;
  onChangeDescription: (description: string) => void;
  onClose: () => void;
  onSaveDescription: () => Promise<void>;
};

export default function CourseDescriptionModal({
  course,
  courseDescription,
  courseTitle,
  isAdminExperience,
  onChangeDescription,
  onClose,
  onSaveDescription,
}: CourseDescriptionModalProps) {
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
            <h3 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
              {t("modernCourseView.overview.aboutCourse")}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-[#676767]" />
            </button>
          </div>

          <div className="mb-6">
            <h4 className="mb-2 text-xl font-bold text-[#363636]">{courseTitle}</h4>
            <div className="flex items-center gap-2 text-sm text-[#676767]">
              <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-[#3f58b6]">
                {course.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(course.estimatedDurationSeconds)}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h5 className="mb-3 font-bold text-[#363636]">
              {t("modernCourseView.overview.description")}
            </h5>
            {isAdminExperience ? (
              <textarea
                value={courseDescription}
                onChange={(event) => onChangeDescription(event.target.value)}
                className="min-h-[120px] w-full rounded-lg border-2 border-[#e5e5e5] p-3 leading-relaxed text-[#363636] focus:border-[#3f58b6] focus:outline-none"
                placeholder={t("modernCourseView.overview.descriptionPlaceholder")}
                onBlur={() => void onSaveDescription()}
              />
            ) : (
              <p className="leading-relaxed text-[#676767]">{course.description}</p>
            )}
          </div>

          <div className="mb-6">
            <h5 className="mb-3 font-bold text-[#363636]">
              {t("modernCourseView.overview.whatYouWillLearn")}
            </h5>
            <div className="space-y-2" />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#3f58b6] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#324a95]"
            >
              {t("modernCourseView.common.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
