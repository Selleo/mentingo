import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ChapterCard } from "~/modules/Statistics/Client/components/ChapterCard";

import type { GetUserStatisticsResponse } from "~/api/generated-api";

type ContinueLearningCardProps = {
  isLoading: boolean;
  lesson: GetUserStatisticsResponse["data"]["nextLesson"] | undefined;
};

export const ContinueLearningCard = ({ isLoading = false, lesson }: ContinueLearningCardProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col gap-y-4 rounded-lg bg-white p-4 drop-shadow-card 2xl:max-w-[296px]">
        <div className="flex flex-col items-center gap-y-1">
          <Skeleton className="h-[29px] w-full max-w-[240px] rounded-lg" />
          <Skeleton className="h-4 w-full max-w-[160px] rounded-lg" />
        </div>
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div
        id="continue-learning"
        className="flex h-auto w-full flex-col items-center justify-between gap-y-4 rounded-lg bg-white p-8 drop-shadow-card md:gap-8 2xl:max-w-[296px] 2xl:flex-col 2xl:gap-y-4"
      >
        <div className="text-center md:w-fit 2xl:w-full">
          <h2 className="body-lg-md text-neutral-950">
            {t("clientStatisticsView.other.noLessonsToContinue")}
          </h2>
        </div>
        <Icon name="NoData" />
        <Link to="/courses" className="w-full md:w-min 2xl:w-full">
          <Button className="w-full">{t("clientStatisticsView.button.searchCourses")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      id="continue-learning"
      className="flex h-auto w-full flex-col gap-y-4 rounded-lg bg-white p-4 drop-shadow-card md:flex-row md:gap-8 2xl:max-w-[296px] 2xl:flex-col 2xl:gap-y-4"
    >
      <div className="text-center md:w-fit 2xl:w-full">
        <h2 className="body-lg-md text-neutral-950">
          {t("clientStatisticsView.other.continueLearning")}
        </h2>
        <a href={`/course/${lesson?.courseId}`} className="body-sm-md text-primary-700 underline">
          {lesson?.courseTitle}
        </a>
        <p className="sr-only md:not-sr-only md:mt-6 2xl:sr-only">
          <Viewer content={lesson?.courseDescription} variant="content" />
        </p>
      </div>
      <ChapterCard {...lesson} />
    </div>
  );
};
