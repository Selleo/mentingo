import { Link } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useTransferCourseOwnership } from "~/api/mutations/admin/useTransferCourseOwnership";
import { useCourseOwnershipCandidates } from "~/api/queries/admin/useCourseOwnershipCandidates";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import TransferOwnershipSelect from "~/modules/Admin/EditCourse/CourseSettings/components/TransferOwnershipSelect";
import { CourseOptions } from "~/modules/Courses/CourseView/CourseViewSidebar/CourseOptions";
import { CourseProgress } from "~/modules/Courses/CourseView/CourseViewSidebar/CourseProgress";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseViewSidebar = {
  course: GetCourseResponse["data"];
};

export const CourseViewSidebar = ({ course }: CourseViewSidebar) => {
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: userDetails } = useUserDetails(course?.authorId ?? "");
  const { isAdminLike, isAdmin } = useUserRole();

  const { t } = useTranslation();

  const { mutateAsync: transferCourseOwnership, isPending: isTransferPending } =
    useTransferCourseOwnership();
  const { data: courseOwnershipCandidates } = useCourseOwnershipCandidates({
    id: course.id,
    enabled: isAdmin,
  });

  const shouldShowCourseOptions = !course?.enrolled && !isAdminLike;
  const canEditOwner =
    isAdmin && !!course.id && !!courseOwnershipCandidates?.possibleCandidates?.length;

  const handleOwnerChange = async (value: string) => {
    if (!course?.id || value === course.authorId) {
      setSelectedUserId("");
      setIsEditingOwner(false);
      return;
    }

    setSelectedUserId(value);
    await transferCourseOwnership({ courseId: course.id, userId: value });
    setSelectedUserId("");
    setIsEditingOwner(false);
  };

  return (
    <section className="sticky left-0 top-6 flex h-min flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-8 drop-shadow xl:w-full xl:max-w-[480px] 3xl:top-12">
      {shouldShowCourseOptions ? (
        <CourseOptions course={course} />
      ) : (
        <CourseProgress course={course} />
      )}
      <h4 className="h6 pb-1 pt-2 text-neutral-950">
        {t("studentCourseView.sideSection.other.author")}
      </h4>
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="relative flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => canEditOwner && setIsEditingOwner(true)}
            aria-label={t("adminCourseView.settings.transferOwnership.title")}
            className={cn(
              "group flex w-full items-center gap-4 rounded-xl p-2 transition",
              canEditOwner
                ? "cursor-pointer border-[1.5px] border-dashed border-primary-200 hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                : "cursor-default border border-transparent",
            )}
          >
            <UserAvatar
              className="size-20 transition"
              userName={`${userDetails?.firstName} ${userDetails?.lastName}`}
              profilePictureUrl={userDetails?.profilePictureUrl}
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="h6 text-neutral-950">
                  {userDetails?.firstName} {userDetails?.lastName}
                </h2>
              </div>
              <div className="flex flex-col gap-y-1 items-start">
                {userDetails?.jobTitle && (
                  <p className="body-sm">
                    <span className="text-neutral-900">
                      {t("studentCourseView.sideSection.other.title")}:
                    </span>{" "}
                    <span className="body-sm-md text-neutral-950">{userDetails?.jobTitle}</span>
                  </p>
                )}
              </div>
            </div>
          </button>
          {canEditOwner && isEditingOwner && (
            <TransferOwnershipSelect
              value={selectedUserId}
              onChange={handleOwnerChange}
              candidates={courseOwnershipCandidates?.possibleCandidates}
              open={isEditingOwner}
              onOpenChange={(open) => {
                if (!open) setIsEditingOwner(false);
              }}
              triggerClassName="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
              disabled={isTransferPending}
            />
          )}
        </div>
      </div>
      {userDetails?.description && (
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-3">
            <span className="text-neutral-900">
              {t("studentCourseView.sideSection.other.about")}
            </span>
            <div className="h-px w-full bg-primary-200" />
          </div>
          <p className="body-sm mt-2 text-neutral-950">{userDetails?.description}</p>
        </div>
      )}
      <Button variant="outline" className="sr-only">
        <span>{t("studentCourseView.sideSection.other.collapse")}</span>
      </Button>
      <Button variant="outline" asChild>
        <Link to={`/profile/${course?.authorId}`}>
          <span>{t("studentCourseView.sideSection.button.goToContentCreatorPage")}</span>
        </Link>
      </Button>
    </section>
  );
};
