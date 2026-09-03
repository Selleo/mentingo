import { Link } from "@remix-run/react";
import { Check, Clock, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";

import { getAuthorName } from "./author.utils";

import type { GetCourseOwnershipResponse } from "~/api/generated-api";

type Author = {
  description?: string | null;
  firstName?: string | null;
  jobTitle?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

type OtherCourse = {
  category: string;
  enrolledParticipantCount: number;
  estimatedDurationFormatted?: string | null;
  estimatedDurationMinutes?: number | null;
  id: string;
  slug: string;
  title: string;
};

type AuthorModalProps = {
  author?: Author;
  canEditOwner?: boolean;
  courseOwnershipCandidates?: GetCourseOwnershipResponse["data"]["possibleCandidates"];
  isAdminExperience: boolean;
  isSaving: boolean;
  isTransferringOwner?: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onTransferOwner?: (userId: string) => Promise<void>;
  onToggleShowAuthorSection: (visible: boolean) => void;
  otherCourses: OtherCourse[];
  showOtherCourses?: boolean;
  showAuthorSectionDraft: boolean;
};

export default function AuthorModal({
  author,
  canEditOwner = false,
  courseOwnershipCandidates = [],
  isAdminExperience,
  isSaving,
  isTransferringOwner = false,
  onClose,
  onSave,
  onTransferOwner,
  onToggleShowAuthorSection,
  otherCourses,
  showOtherCourses = true,
  showAuthorSectionDraft,
}: AuthorModalProps) {
  const { t } = useTranslation();
  const authorFullName = getAuthorName(author);

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-6xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl"
        noCloseButton
        aria-describedby={undefined}
      >
        <div className="flex flex-col md:flex-row">
          <div className="relative flex shrink-0 items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-6 md:w-72 md:rounded-l-2xl">
            <button
              type="button"
              aria-label={t("modernCourseView.author.close")}
              onClick={onClose}
              disabled={isSaving}
              className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-neutral-100 md:right-4 md:top-4 md:hidden"
            >
              <X className="size-5 text-neutral-800" />
            </button>
            <UserAvatar
              userName={authorFullName}
              profilePictureUrl={author?.profilePictureUrl}
              className="size-24 min-h-24 min-w-24 max-h-24 max-w-24 md:size-28 md:min-h-28 md:min-w-28 md:max-h-28 md:max-w-28"
            />
          </div>

          <div className="relative min-w-0 flex-1 p-4 md:p-6 lg:p-8">
            <button
              type="button"
              aria-label={t("modernCourseView.author.close")}
              onClick={onClose}
              disabled={isSaving}
              className="absolute right-4 top-4 hidden size-10 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 md:block"
            >
              <X className="mx-auto size-5 text-neutral-800" />
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
                  <Switch
                    checked={showAuthorSectionDraft}
                    onCheckedChange={onToggleShowAuthorSection}
                    disabled={isSaving}
                    aria-label={t("modernCourseView.author.showSection")}
                  />
                </div>
              </div>
            )}

            <div className="mb-8">
              <DialogTitle className="mb-2 font-gothic text-3xl font-bold text-neutral-950">
                {canEditOwner && onTransferOwner ? (
                  <Select
                    disabled={isSaving || isTransferringOwner}
                    onValueChange={(userId) => void onTransferOwner(userId)}
                  >
                    <SelectTrigger
                      data-testid={COURSE_OVERVIEW_HANDLES.AUTHOR_TRANSFER_BUTTON}
                      title={t("adminCourseView.settings.transferOwnership.title")}
                      className="h-auto w-full min-w-0 justify-start rounded-lg border border-dashed border-primary-300 bg-transparent px-2 py-1 font-gothic text-3xl font-bold text-neutral-950 shadow-none hover:bg-neutral-50 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-primary-200 data-[placeholder]:text-neutral-950 [&>span]:text-neutral-950 [&>svg]:hidden"
                    >
                      <SelectValue placeholder={authorFullName} />
                    </SelectTrigger>
                    <SelectContent>
                      {courseOwnershipCandidates.map((candidate) => (
                        <SelectItem
                          key={candidate.id}
                          value={candidate.id}
                          data-testid={COURSE_OVERVIEW_HANDLES.transferOwnershipOption(
                            candidate.id,
                          )}
                        >
                          <div className="flex flex-col items-start text-left">
                            <span className="font-medium">{candidate.name}</span>
                            <span className="text-xs text-neutral-500">{candidate.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  authorFullName
                )}
              </DialogTitle>
              <p className="mb-4 text-lg text-primary-700">{author?.jobTitle}</p>
              <p className="leading-relaxed text-neutral-800">{author?.description}</p>
            </div>

            {showOtherCourses && (
              <div>
                <h4 className="mb-4 font-gothic text-xl font-bold text-neutral-950">
                  {t("modernCourseView.author.otherCourses")}
                </h4>
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
                  {otherCourses.map((course) => (
                    <Link
                      key={course.id}
                      to={`/course/${course.slug}`}
                      onClick={onClose}
                      className="group block cursor-pointer rounded-xl border border-neutral-200 p-4 transition-all hover:border-primary-700 hover:shadow-md"
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
                          <Users className="size-3" />
                          <span>{course.enrolledParticipantCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>
                            {course.estimatedDurationMinutes != null
                              ? formatDuration(course.estimatedDurationMinutes * 60, t)
                              : (course.estimatedDurationFormatted ?? "—")}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                {isAdminExperience
                  ? t("modernCourseView.common.cancel")
                  : t("modernCourseView.common.close")}
              </Button>
              {isAdminExperience && (
                <Button
                  onClick={() => void onSave()}
                  disabled={isSaving}
                  className="order-1 flex  items-center justify-center gap-2 sm:order-2 ml-3"
                >
                  <Check className="size-4" />
                  {t("modernCourseView.common.saveChanges")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
