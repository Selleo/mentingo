import { PERMISSIONS } from "@repo/shared";
import { Award, Calendar, Check, Clock, Upload, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useBulkGroupCourseEnroll } from "~/api/mutations/admin/useBulkGroupCourseEnroll";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useUpdateHasCertificate } from "~/api/mutations/useUpdateHasCertificate";
import { useCurrentUser } from "~/api/queries";
import { useGroupsByCourseQuery } from "~/api/queries/admin/useGroupsByCourse";
import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { usePermissions } from "~/hooks/usePermissions";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import { useCourseAccessProvider } from "../context/CourseAccessProvider";

import type { SupportedLanguages } from "@repo/shared";
import type { GetCourseResponse } from "~/api/generated-api";

type CourseHeroProps = {
  course: GetCourseResponse["data"];
  language: SupportedLanguages;
};

type GroupDeadline = {
  id: string;
  name: string;
  deadline: string;
};

export function CourseStatBar({ course, language }: CourseHeroProps) {
  const { t } = useTranslation();
  const hasCertificate = Boolean(course.hasCertificate);
  const hasAuthor = Boolean(course.authorId);
  const showAuthorSection = course.showAuthorSection ?? true;

  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [showAuthorSectionDraft, setShowAuthorSectionDraft] = useState(showAuthorSection);
  const [deadlineEnabledDraft, setDeadlineEnabledDraft] = useState(Boolean(course.dueDate));
  const [groupDeadlines, setGroupDeadlines] = useState<GroupDeadline[]>([]);
  const [certificateEnabledDraft, setCertificateEnabledDraft] = useState(hasCertificate);

  const { mutate: updateHasCertificate, isPending: isUpdatingCertificate } =
    useUpdateHasCertificate();
  const { mutateAsync: updateCourse, isPending: isUpdatingAuthorSection } = useUpdateCourse();
  const { mutate: updateGroupDeadlines, isPending: isUpdatingDeadlines } = useBulkGroupCourseEnroll(
    course.id,
  );

  useEffect(() => {
    setCertificateEnabledDraft(hasCertificate);
  }, [hasCertificate]);

  const openCertificateModal = () => {
    setCertificateEnabledDraft(hasCertificate);
    setShowCertificateModal(true);
  };
  const closeCertificateModal = () => {
    setCertificateEnabledDraft(hasCertificate);
    setShowCertificateModal(false);
  };
  useEffect(() => {
    setShowAuthorSectionDraft(showAuthorSection);
  }, [showAuthorSection]);

  const openAuthorModal = () => {
    setShowAuthorSectionDraft(showAuthorSection);
    setShowAuthorModal(true);
  };

  const closeAuthorModal = () => {
    setShowAuthorSectionDraft(showAuthorSection);
    setShowAuthorModal(false);
  };

  const { data: author } = useUserDetails(course.authorId);
  const saveCertificate = () => {
    updateHasCertificate(
      {
        courseId: course.id,
        data: {
          hasCertificate: certificateEnabledDraft,
        },
      },
      {
        onSuccess: () => {
          setShowCertificateModal(false);
        },
      },
    );
  };

  const { data: currentUser } = useCurrentUser();

  const { hasAccess: canManageUsers } = usePermissions({
    required: PERMISSIONS.USER_MANAGE,
  });

  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });

  const { isCourseStudentModeActive } = useCourseAccessProvider();
  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);
  const canEditCourse = canManageUsers || (canManageCourses && course.authorId === currentUser?.id);

  const { data: otherCourses = [] } = useContentCreatorCourses(
    course.authorId,
    {
      scope: "available",
      excludeCourseId: course.id,
      language,
    },
    true,
  );

  const isAdminExperience = canEditCourse && !isCourseStudentModeActive;
  const { data: enrolledGroups } = useGroupsByCourseQuery(
    isAdminExperience ? course.id : "",
    language,
  );
  const hasDeadline = isAdminExperience
    ? enrolledGroups?.some((group) => Boolean(group.isMandatory && group.dueDate))
    : Boolean(course.dueDate);

  const resetDeadlineDraft = useCallback(() => {
    const groups = enrolledGroups ?? [];

    setGroupDeadlines(
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        deadline: group.dueDate?.slice(0, 10) ?? "",
      })),
    );
    setDeadlineEnabledDraft(groups.some((group) => Boolean(group.isMandatory && group.dueDate)));
  }, [enrolledGroups]);

  useEffect(() => {
    resetDeadlineDraft();
  }, [resetDeadlineDraft]);

  const openDeadlineModal = () => {
    resetDeadlineDraft();
    setShowDeadlineModal(true);
  };

  const closeDeadlineModal = () => {
    resetDeadlineDraft();
    setShowDeadlineModal(false);
  };
  const saveDeadlines = () => {
    updateGroupDeadlines(
      {
        groups: groupDeadlines.map((group) => ({
          id: group.id,
          isMandatory: deadlineEnabledDraft,
          dueDate:
            deadlineEnabledDraft && group.deadline ? new Date(group.deadline).toISOString() : null,
        })),
      },
      {
        onSuccess: () => setShowDeadlineModal(false),
      },
    );
  };
  const saveAuthorSection = async () => {
    await updateCourse({
      courseId: course.id,
      data: {
        language,
        showAuthorSection: showAuthorSectionDraft,
      },
    });

    setShowAuthorModal(false);
  };
  const timeLeftSeconds = course.chapters
    .flatMap((chapter) => chapter.lessons)
    .filter((lesson) => lesson.status !== "completed")
    .reduce((total, lesson) => total + (lesson.estimatedDurationSeconds ?? 0), 0);
  const [certificateColor, setCertificateColor] = useState("#3f58b6");
  return (
    <div
      className={`grid gap-4 mb-4 md:mb-6 ${
        isAdminExperience
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          : (() => {
              const visibleCards =
                1 +
                (hasDeadline ? 1 : 0) +
                (hasCertificate ? 1 : 0) +
                (showAuthorSection && hasAuthor ? 1 : 0);
              if (visibleCards === 1) return "grid-cols-1";
              if (visibleCards === 2) return "grid-cols-1 sm:grid-cols-2";
              if (visibleCards === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
              return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
            })()
      }`}
    >
      {/* Progress & Duration Combined - Always visible */}
      <div
        className={`bg-white rounded-2xl p-4 shadow-lg border-l-4 border-[#26b183] relative group ${
          isAdminExperience ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-[#26b183]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#676767] uppercase tracking-wider mb-0.5">Your Progress</p>

            {/* Time remaining - always in one line */}
            <div className="mb-1.5">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-[#363636] whitespace-nowrap">
                  {isAdminExperience ? 0 : formatDuration(timeLeftSeconds)}
                </span>
                <span className="text-sm text-[#676767] whitespace-nowrap">remaining</span>
              </div>
            </div>
          </div>
        </div>
        {isAdminExperience && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-2xl">
            <p className="text-sm text-[#363636] font-semibold px-4 text-center">
              <button
                onClick={() => toggleLearningMode({ enabled: false })}
                className="text-[#3f58b6] underline hover:text-[#324a95] transition-colors"
              >
                Enter learning mode
              </button>{" "}
              to track your progress.
            </p>
          </div>
        )}
      </div>

      {/* Deadline - Opens Modal - Conditional in learning mode */}
      {(isAdminExperience || hasDeadline) && (
        <button
          type="button"
          disabled={!isAdminExperience}
          onClick={() => isAdminExperience && openDeadlineModal()}
          className={`text-left bg-white rounded-2xl p-4 shadow-lg border-l-4 border-[#D4705D] ${
            isAdminExperience
              ? "cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all hover:outline hover:outline-2 hover:outline-dashed hover:outline-[#D4705D]/40"
              : ""
          } ${isAdminExperience && !hasDeadline ? "opacity-50" : ""}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-3">
              <Calendar className="w-6 h-6 text-[#D4705D]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#676767] uppercase tracking-wider mb-0.5">Deadline</p>
              {isAdminExperience ? (
                <p className="text-xl font-bold text-[#363636]">
                  {hasDeadline ? "Enabled" : "Disabled"}
                </p>
              ) : (
                <>
                  <p className="text-xl font-bold text-[#363636]">9 days left</p>
                  <p className="text-xs text-[#676767]">March 15, 2026</p>
                </>
              )}
            </div>
          </div>
        </button>
      )}

      {/* Certificate - Opens Modal - Conditional in learning mode */}
      {(isAdminExperience || hasCertificate) && (
        <button
          type="button"
          disabled={!isAdminExperience}
          onClick={() => isAdminExperience && openCertificateModal()}
          className={`text-left bg-white rounded-2xl p-4 shadow-lg border-l-4 border-[#26b183] ${
            isAdminExperience
              ? "cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all hover:outline hover:outline-2 hover:outline-dashed hover:outline-[#26b183]/40"
              : ""
          } ${isAdminExperience && !hasCertificate ? "opacity-50" : ""}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-3">
              <Award className="w-6 h-6 text-[#26b183]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#676767] uppercase tracking-wider mb-0.5">Certificate</p>
              <p className="text-xl font-bold text-[#363636]">
                {isAdminExperience ? (hasCertificate ? "Enabled" : "Disabled") : "Upon completion"}
              </p>
            </div>
          </div>
        </button>
      )}

      {/* About Author - Opens Modal */}
      {(isAdminExperience || (showAuthorSection && hasAuthor)) && (
        <button
          type="button"
          onClick={openAuthorModal}
          className={`text-left bg-white rounded-2xl p-4 shadow-lg border-l-4 border-[#3f58b6] cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all ${
            isAdminExperience
              ? "hover:outline hover:outline-2 hover:outline-dashed hover:outline-[#3f58b6]/40"
              : ""
          } ${isAdminExperience && !showAuthorSection ? "opacity-50" : ""}`}
        >
          <div className="flex items-center gap-4">
            <img
              src={
                author?.profilePictureUrl ??
                "https://images.unsplash.com/vector-1756860574486-9e0c75696f6c?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              }
              alt={
                author?.firstName && author?.lastName
                  ? author?.firstName + " " + author?.lastName
                  : "author picture"
              }
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1">
              <p className="text-xs text-[#676767] uppercase tracking-wider mb-0.5">About Author</p>
              <p className="text-lg font-bold text-[#363636]">
                {author?.firstName + " " + author?.lastName}
              </p>
              <p className="text-xs text-[#676767]">{author?.jobTitle}</p>
            </div>
          </div>
        </button>
      )}

      {showCertificateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <button
            type="button"
            aria-label="Close certificate settings"
            className="absolute inset-0 bg-black/50"
            onClick={closeCertificateModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-4 md:p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
                Certificate Settings
              </h3>
              <button type="button" onClick={closeCertificateModal}>
                <X className="w-5 h-5 md:w-6 md:h-6 text-[#676767]" />
              </button>
            </div>

            {/* Certificate Preview */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 md:p-8 mb-6 border-4 border-[#e5e5e5]">
              <div className="text-center">
                <h2
                  className="mb-4 font-gothic text-2xl font-bold md:text-4xl"
                  style={{ color: certificateColor }}
                >
                  Certificate of Completion
                </h2>
                <p className="text-base md:text-lg text-[#676767] mb-4 md:mb-6">
                  This certifies that
                </p>
                <p className="text-xl md:text-3xl font-bold text-[#363636] mb-4 md:mb-6">
                  Ellis Admin
                </p>
                <p className="text-base md:text-lg text-[#676767] mb-2">
                  has successfully completed
                </p>
                <p className="text-lg md:text-2xl font-bold text-[#363636] mb-6 md:mb-8">
                  {course?.title}
                </p>
                <div className="border-t-2 border-[#e5e5e5] pt-6">
                  <p className="text-sm text-[#676767]">Signature placeholder</p>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              {/* Enable Certificate Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#f9fafb] rounded-xl border border-[#e5e5e5]">
                <div>
                  <p className="font-semibold text-[#363636]">Enable Certificate</p>
                  <p className="text-sm text-[#676767]">
                    Students will receive a certificate upon course completion
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={certificateEnabledDraft}
                  onClick={() => setCertificateEnabledDraft((enabled) => !enabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    certificateEnabledDraft ? "bg-[#26b183]" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      certificateEnabledDraft ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>

              {certificateEnabledDraft && (
                <>
                  <div>
                    <label
                      htmlFor="certificate-font-color"
                      className="block text-sm font-semibold text-[#363636] mb-2"
                    >
                      Font Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="certificate-font-color"
                        type="color"
                        value={certificateColor}
                        onChange={(e) => setCertificateColor(e.target.value)}
                        className="w-16 h-10 rounded-lg border border-[#e5e5e5] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={certificateColor}
                        onChange={(e) => setCertificateColor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="block text-sm font-semibold text-[#363636] mb-2">
                      Upload Signature
                    </p>
                    <div className="border-2 border-dashed border-[#e5e5e5] rounded-xl p-6 text-center hover:border-[#3f58b6] transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 text-[#676767] mx-auto mb-2" />
                      <p className="text-sm text-[#676767]">Click to upload signature image</p>
                      <p className="text-xs text-[#676767] mt-1">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={closeCertificateModal}
                disabled={isUpdatingCertificate}
                className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-[#363636] rounded-lg font-semibold hover:bg-gray-300 transition-colors order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCertificate}
                disabled={isUpdatingCertificate}
                className="w-full sm:w-auto px-6 py-2 bg-[#3f58b6] text-white rounded-lg font-semibold hover:bg-[#324a95] transition-colors flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                <Check className="w-4 h-4" />
                Save Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deadline Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <button
            type="button"
            aria-label="Close deadline settings"
            className="absolute inset-0 bg-black/50"
            onClick={closeDeadlineModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-4 md:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
                Deadline Settings
              </h3>
              <button type="button" onClick={closeDeadlineModal}>
                <X className="w-5 h-5 md:w-6 md:h-6 text-[#676767]" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Enable Deadline Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#f9fafb] rounded-xl border border-[#e5e5e5]">
                <div>
                  <p className="font-semibold text-[#363636]">Enable Deadlines</p>
                  <p className="text-sm text-[#676767]">
                    Set specific deadlines for different groups
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={deadlineEnabledDraft}
                  disabled={groupDeadlines.length === 0}
                  onClick={() => setDeadlineEnabledDraft((enabled) => !enabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors ${groupDeadlines.length === 0 ? "cursor-not-allowed" : ""}  ${
                    deadlineEnabledDraft ? "bg-[#D4705D]" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      deadlineEnabledDraft ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>

              {groupDeadlines.length === 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {t("adminCourseView.deadlineNoAssignedGroups")}
                </p>
              )}

              {deadlineEnabledDraft &&
                groupDeadlines.map((group) => (
                  <div
                    key={group.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-[#f9fafb] rounded-xl border border-[#e5e5e5]"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-[#363636]">{group.name}</p>
                      <p className="text-sm text-[#676767]">Current deadline: {group.deadline}</p>
                    </div>
                    <input
                      type="date"
                      value={group.deadline}
                      onChange={(e) => {
                        const updated = groupDeadlines.map((g) =>
                          g.id === group.id ? { ...g, deadline: e.target.value } : g,
                        );
                        setGroupDeadlines(updated);
                      }}
                      className="w-full sm:w-auto px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm"
                    />
                  </div>
                ))}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={closeDeadlineModal}
                disabled={isUpdatingDeadlines}
                className="w-full sm:w-auto px-6 py-2 bg-gray-200 text-[#363636] rounded-lg font-semibold hover:bg-gray-300 transition-colors order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDeadlines}
                disabled={
                  isUpdatingDeadlines ||
                  groupDeadlines.length === 0 ||
                  (deadlineEnabledDraft && groupDeadlines.some((group) => !group.deadline))
                }
                className="w-full sm:w-auto px-6 py-2 bg-[#3f58b6] text-white rounded-lg font-semibold hover:bg-[#324a95] transition-colors order-1 sm:order-2"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Author Modal */}
      {showAuthorModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <button
            type="button"
            aria-label="Close author settings"
            className="absolute inset-0 bg-black/50"
            onClick={closeAuthorModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col md:flex-row">
              {/* Left side - Large author image */}
              <div className="md:w-2/5 bg-gradient-to-br from-[#f5f7fa] to-[#e8eef5] flex items-center justify-center p-6 md:p-8 md:rounded-l-2xl relative">
                <button
                  onClick={closeAuthorModal}
                  className="absolute top-2 right-2 md:top-4 md:right-4 w-10 h-10 bg-white hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors shadow-md md:hidden"
                >
                  <X className="w-5 h-5 text-[#676767]" />
                </button>
                <img
                  src="https://images.unsplash.com/photo-1616065297556-f05bc00c9a3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMGZ1bGwlMjBib2R5JTIwcG9ydHJhaXQlMjBidXNpbmVzc3xlbnwxfHx8fDE3NzM4MjA4MTV8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt={
                    author?.firstName && author?.lastName
                      ? author?.firstName + " " + author?.lastName
                      : "author picture"
                  }
                  className="w-full h-auto object-cover rounded-xl shadow-lg"
                />
              </div>

              {/* Right side - Content */}
              <div className="md:w-3/5 p-4 md:p-6 lg:p-8 relative">
                <button
                  onClick={closeAuthorModal}
                  className="hidden md:block absolute top-4 right-4 w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-[#676767] mx-auto mt-2.5" />
                </button>
                {/* Admin Toggle for Show/Hide */}
                {isAdminExperience && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#363636] text-sm">Show Author Section</p>
                        <p className="text-xs text-[#676767]">
                          Display author information on course page
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showAuthorSectionDraft}
                        className={`relative w-14 h-7 rounded-full transition-colors ${
                          showAuthorSectionDraft ? "bg-[#26b183]" : "bg-gray-300"
                        }`}
                        onClick={() => setShowAuthorSectionDraft((visible) => !visible)}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                            showAuthorSectionDraft ? "translate-x-7" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Author info */}
                <div className="mb-8">
                  <h3 className="mb-2 font-gothic text-3xl font-bold text-[#363636]">
                    {author?.firstName + " " + author?.lastName}
                  </h3>
                  <p className="text-lg text-[#3f58b6] mb-4">{author?.jobTitle}</p>
                  <p className="text-[#676767] leading-relaxed">{author?.description}</p>
                </div>

                {/* Other Courses */}
                <div>
                  <h4 className="mb-4 font-gothic text-xl font-bold text-[#363636]">
                    Other Courses
                  </h4>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {otherCourses.map((course) => (
                      <div
                        key={course.id}
                        className="bg-[#f9fafb] rounded-xl p-4 border border-[#e5e5e5] hover:border-[#3f58b6] hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="mb-2">
                          <h5 className="font-bold text-[#363636] mb-1 group-hover:text-[#3f58b6] transition-colors leading-snug">
                            {course.title}
                          </h5>
                          <span className="inline-block px-2 py-1 bg-blue-100 text-[#3f58b6] text-xs font-semibold rounded">
                            {course.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#676767]">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{course.enrolledParticipantCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
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
                    onClick={closeAuthorModal}
                    disabled={isUpdatingAuthorSection}
                    className="w-full rounded-lg bg-gray-200 px-6 py-2 font-semibold text-[#363636] transition-colors hover:bg-gray-300 sm:w-auto"
                  >
                    {isAdminExperience ? "Cancel" : "Close"}
                  </button>
                  {isAdminExperience && (
                    <button
                      type="button"
                      onClick={() => void saveAuthorSection()}
                      disabled={isUpdatingAuthorSection}
                      className="ml-3 w-full rounded-lg bg-[#3f58b6] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#324a95] disabled:opacity-50 sm:w-auto"
                    >
                      Save changes
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
