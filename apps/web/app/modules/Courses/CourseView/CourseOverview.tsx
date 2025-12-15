import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import { Icon } from "~/components/Icon";
import Viewer from "~/components/RichText/Viever";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { CategoryChip } from "~/components/ui/CategoryChip";
import { useUserRole } from "~/hooks/useUserRole";
import { courseLanguages } from "~/modules/Admin/EditCourse/compontents/LanguageSelector";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseOverviewProps = {
  course: GetCourseResponse["data"];
};

export default function CourseOverview({ course }: CourseOverviewProps) {
  const imageUrl = course?.thumbnailUrl ?? CardPlaceholder;
  const title = course?.title;
  const description = course?.description || "";

  const { isAdminLike, isAdmin } = useUserRole();
  const { currentUser } = useCurrentUserStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navigateToEditCourse = () => navigate(`/admin/beta-courses/${course.id}`);

  return (
    <Card className="w-full border-none pt-1 drop-shadow-primary lg:pt-0">
      <CardContent className="flex flex-col px-0">
        {(isAdmin || (isAdminLike && course.authorId === currentUser?.id)) && (
          <div className="border-b border-1 border-neutral-200 flex items-center justify-end p-4 px-6 mb-8 xl:mb-0">
            <Button className="flex gap-2" variant="primary" onClick={navigateToEditCourse}>
              <Icon name="Edit" className="size-4" />
              {t("pages.editCourse")}
            </Button>
          </div>
        )}
        <div className="align-center flex flex-col gap-6 px-4 lg:p-8 2xl:flex-row">
          <div className="relative aspect-video w-full self-start lg:max-w-[320px]">
            <img
              src={imageUrl}
              alt={title}
              loading="eager"
              decoding="async"
              className="h-full w-full rounded-lg object-cover drop-shadow-sm"
              onError={(event) => {
                event.currentTarget.src = CardPlaceholder;
              }}
            />
          </div>
          <div className="flex w-full flex-col gap-y-2">
            <div className="flex justify-between items-center">
              <CategoryChip category={course?.category} className="bg-primary-50" />

              <Badge variant="default" className="flex gap-2">
                {courseLanguages
                  .filter((item) => course.availableLocales.includes(item.key))
                  .map((item) => (
                    <Icon key={item.key} name={item.iconName} className="size-4" />
                  ))}
              </Badge>
            </div>
            <h5 className="h5">{title}</h5>
            <Viewer
              content={description}
              className="body-base mt-2 text-neutral-900"
              variant="lesson"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
