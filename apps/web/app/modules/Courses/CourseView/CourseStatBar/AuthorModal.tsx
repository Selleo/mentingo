import { Award, Clock, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { DEFAULT_AUTHOR_MODAL_IMAGE, getAuthorName } from "./author.utils";

type Author = {
  description?: string | null;
  firstName?: string | null;
  jobTitle?: string | null;
  lastName?: string | null;
};

type OtherCourse = {
  category: string;
  enrolledParticipantCount: number;
  estimatedDurationFormatted?: string | null;
  id: string;
  title: string;
};

type AuthorModalProps = {
  author?: Author;
  isAdminExperience: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onToggleShowAuthorSection: () => void;
  otherCourses: OtherCourse[];
  showAuthorSectionDraft: boolean;
};

export default function AuthorModal({
  author,
  isAdminExperience,
  isSaving,
  onClose,
  onSave,
  onToggleShowAuthorSection,
  otherCourses,
  showAuthorSectionDraft,
}: AuthorModalProps) {
  const { t } = useTranslation();
  const authorName = getAuthorName(author);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("modernCourseView.author.close")}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col md:flex-row">
          <div className="relative flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-6 md:w-2/5 md:rounded-l-2xl md:p-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-neutral-100 md:right-4 md:top-4 md:hidden"
            >
              <X className="h-5 w-5 text-neutral-800" />
            </button>
            <img
              src={DEFAULT_AUTHOR_MODAL_IMAGE}
              alt={authorName || t("modernCourseView.author.pictureAlt")}
              className="h-auto w-full rounded-xl object-cover shadow-lg"
            />
          </div>

          <div className="relative p-4 md:w-3/5 md:p-6 lg:p-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 hidden h-10 w-10 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 md:block"
            >
              <X className="mx-auto mt-2.5 h-5 w-5 text-neutral-800" />
            </button>
            {isAdminExperience && (
              <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      {t("modernCourseView.author.showSection")}
                    </p>
                    <p className="text-xs text-neutral-800">
                      {t("modernCourseView.author.showSectionDescription")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showAuthorSectionDraft}
                    className={cn("relative h-7 w-14 rounded-full transition-colors", {
                      "bg-success-500": showAuthorSectionDraft,
                      "bg-neutral-300": !showAuthorSectionDraft,
                    })}
                    onClick={onToggleShowAuthorSection}
                  >
                    <div
                      className={cn(
                        "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform",
                        showAuthorSectionDraft ? "translate-x-7" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h3 className="mb-2 font-gothic text-3xl font-bold text-neutral-950">{authorName}</h3>
              <p className="mb-4 text-lg text-primary-700">{author?.jobTitle}</p>
              <p className="leading-relaxed text-neutral-800">{author?.description}</p>
            </div>

            <div>
              <h4 className="mb-4 font-gothic text-xl font-bold text-neutral-950">
                {t("modernCourseView.author.otherCourses")}
              </h4>
              <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
                {otherCourses.map((course) => (
                  <div
                    key={course.id}
                    className="group cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 p-4 transition-all hover:border-primary-700 hover:shadow-md"
                  >
                    <div className="mb-2">
                      <h5 className="mb-1 font-bold leading-snug text-neutral-950 transition-colors group-hover:text-primary-700">
                        {course.title}
                      </h5>
                      <span className="inline-block rounded bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-700">
                        {course.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-800">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{course.enrolledParticipantCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="h-3 w-3 text-warning-500" />
                        <span>4.8</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{course.estimatedDurationFormatted ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="w-full rounded-lg bg-neutral-200 px-6 py-2 font-semibold text-neutral-950 transition-colors hover:bg-neutral-300 sm:w-auto"
              >
                {isAdminExperience
                  ? t("modernCourseView.common.cancel")
                  : t("modernCourseView.common.close")}
              </button>
              {isAdminExperience && (
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={isSaving}
                  className="ml-3 w-full rounded-lg bg-primary-700 px-6 py-2 font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-50 sm:w-auto"
                >
                  {t("modernCourseView.common.saveChanges")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
