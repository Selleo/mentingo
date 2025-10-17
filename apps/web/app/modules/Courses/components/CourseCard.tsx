import { Link, useLocation } from "@remix-run/react";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { CardBadge } from "~/components/CardBadge";
import CourseProgress from "~/components/CourseProgress";
import { Icon } from "~/components/Icon";
import { CategoryChip } from "~/components/ui/CategoryChip";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import CourseCardButton from "~/modules/Dashboard/Courses/CourseCardButton";

import { CourseCardTitle } from "./CourseCardTitle";

import type { GetAvailableCoursesResponse } from "~/api/generated-api";

export type CourseCardProps = GetAvailableCoursesResponse["data"][number];

const CourseCard = ({
  author,
  authorEmail = "",
  authorAvatarUrl,
  category,
  completedChapterCount,
  courseChapterCount,
  currency,
  description,
  enrolled = false,
  hasFreeChapters,
  id,
  thumbnailUrl,
  priceInCents,
  title,
}: CourseCardProps) => {
  const { isAdmin } = useUserRole();
  const { pathname } = useLocation();
  const isScormCreatePage = pathname.includes("/admin/courses/new-scorm");

  return (
    <Link
      to={isScormCreatePage ? "#" : `/course/${id}`}
      data-testid={title}
      className={cn(
        "flex h-auto w-full max-w-[320px] flex-col overflow-hidden rounded-lg border bg-white transition hover:shadow-primary lg:bg-none",
        {
          "border-secondary-200 hover:border-secondary-500": enrolled,
          "border-primary-200 hover:border-primary-500": !enrolled,
        },
      )}
    >
      <div className="relative">
        <img
          src={thumbnailUrl || DefaultPhotoCourse}
          alt="Course"
          loading="eager"
          decoding="async"
          className="aspect-video w-full rounded-t-lg object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DefaultPhotoCourse;
          }}
        />
        <div className="absolute left-4 right-4 top-4 flex flex-col gap-y-1">
          <CategoryChip
            category={category}
            color={cn({
              "text-secondary-600": enrolled,
              "text-primary-700": isAdmin || !enrolled,
            })}
          />
          {hasFreeChapters && !enrolled && (
            <CardBadge variant="successFilled">
              <Icon name="FreeRight" className="w-4" />
              Free Lessons!
            </CardBadge>
          )}
        </div>
      </div>
      <div className={cn("flex flex-grow flex-col p-4")}>
        <div className="flex flex-grow flex-col">
          {enrolled && (
            <CourseProgress
              label="Course progress:"
              courseLessonCount={courseChapterCount}
              completedLessonCount={completedChapterCount}
            />
          )}
          <div className={cn({ "mt-3": enrolled })}>
            <CourseCardTitle title={title} />
          </div>
          {authorEmail && (
            <div className="mb-2 mt-2 flex items-center gap-x-1.5">
              <UserAvatar
                className="size-4"
                userName={author}
                profilePictureUrl={authorAvatarUrl}
              />
              <span className="body-sm text-neutral-950">{author}</span>
            </div>
          )}
          <div className="flex-grow body-sm text-neutral-500">
            <span className="line-clamp-3">
              <div dangerouslySetInnerHTML={{ __html: description }} />
            </span>
          </div>
        </div>
        <div className="mt-4">
          <CourseCardButton
            currency={currency}
            enrolled={enrolled}
            isAdmin={isAdmin}
            priceInCents={priceInCents}
            isScormCreatePage={isScormCreatePage}
          />
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
