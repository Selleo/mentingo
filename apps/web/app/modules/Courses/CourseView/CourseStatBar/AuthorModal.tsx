import { Award, Clock, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";

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

const AUTHOR_IMAGE =
  "https://images.unsplash.com/photo-1616065297556-f05bc00c9a3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMGZ1bGwlMjBib2R5JTIwcG9ydHJhaXQlMjBidXNpbmVzc3xlbnwxfHx8fDE3NzM4MjA4MTV8MA&ixlib=rb-4.1.0&q=80&w=1080";

const getAuthorName = (author?: Author) => {
  if (!author?.firstName && !author?.lastName) return "";
  return `${author.firstName ?? ""} ${author.lastName ?? ""}`.trim();
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
          <div className="relative flex items-center justify-center bg-gradient-to-br from-[#f5f7fa] to-[#e8eef5] p-6 md:w-2/5 md:rounded-l-2xl md:p-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-gray-100 md:right-4 md:top-4 md:hidden"
            >
              <X className="h-5 w-5 text-[#676767]" />
            </button>
            <img
              src={AUTHOR_IMAGE}
              alt={authorName || t("modernCourseView.author.pictureAlt")}
              className="h-auto w-full rounded-xl object-cover shadow-lg"
            />
          </div>

          <div className="relative p-4 md:w-3/5 md:p-6 lg:p-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 hidden h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 md:block"
            >
              <X className="mx-auto mt-2.5 h-5 w-5 text-[#676767]" />
            </button>
            {isAdminExperience && (
              <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#363636]">
                      {t("modernCourseView.author.showSection")}
                    </p>
                    <p className="text-xs text-[#676767]">
                      {t("modernCourseView.author.showSectionDescription")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showAuthorSectionDraft}
                    className={`relative h-7 w-14 rounded-full transition-colors ${
                      showAuthorSectionDraft ? "bg-[#26b183]" : "bg-gray-300"
                    }`}
                    onClick={onToggleShowAuthorSection}
                  >
                    <div
                      className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                        showAuthorSectionDraft ? "translate-x-7" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h3 className="mb-2 font-gothic text-3xl font-bold text-[#363636]">{authorName}</h3>
              <p className="mb-4 text-lg text-[#3f58b6]">{author?.jobTitle}</p>
              <p className="leading-relaxed text-[#676767]">{author?.description}</p>
            </div>

            <div>
              <h4 className="mb-4 font-gothic text-xl font-bold text-[#363636]">
                {t("modernCourseView.author.otherCourses")}
              </h4>
              <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
                {otherCourses.map((course) => (
                  <div
                    key={course.id}
                    className="cursor-pointer rounded-xl border border-[#e5e5e5] bg-[#f9fafb] p-4 transition-all hover:border-[#3f58b6] hover:shadow-md group"
                  >
                    <div className="mb-2">
                      <h5 className="mb-1 font-bold leading-snug text-[#363636] transition-colors group-hover:text-[#3f58b6]">
                        {course.title}
                      </h5>
                      <span className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-[#3f58b6]">
                        {course.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#676767]">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{course.enrolledParticipantCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="h-3 w-3 text-[#FFB800]" />
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
                className="w-full rounded-lg bg-gray-200 px-6 py-2 font-semibold text-[#363636] transition-colors hover:bg-gray-300 sm:w-auto"
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
                  className="ml-3 w-full rounded-lg bg-[#3f58b6] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#324a95] disabled:opacity-50 sm:w-auto"
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
