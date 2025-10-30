import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import Viewer from "~/components/RichText/Viever";
import { Card, CardContent } from "~/components/ui/card";
import { CategoryChip } from "~/components/ui/CategoryChip";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseOverviewProps = {
  course: GetCourseResponse["data"];
};

export default function CourseOverview({ course }: CourseOverviewProps) {
  const imageUrl = course?.thumbnailUrl ?? CardPlaceholder;
  const title = course?.title;
  const description = course?.description || "";

  return (
    <Card className="w-full border-none pt-6 drop-shadow-primary lg:pt-0">
      <CardContent className="align-center flex flex-col gap-6 lg:p-8 2xl:flex-row">
        <div className="relative aspect-video w-full self-start lg:max-w-[320px]">
          <img
            src={imageUrl}
            alt={title}
            loading="eager"
            decoding="async"
            className="h-full w-full rounded-lg object-cover drop-shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).src = CardPlaceholder;
            }}
          />
        </div>
        <div className="flex w-full flex-col gap-y-2">
          <CategoryChip category={course?.category} className="bg-primary-50" />
          <h5 className="h5">{title}</h5>
          <Viewer
            content={description}
            className="body-base mt-2 text-neutral-900"
            variant="lesson"
          />
        </div>
      </CardContent>
    </Card>
  );
}
