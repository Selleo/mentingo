import { BarChart2, CheckCircle2, Clock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import type { GetCourseStatisticsResponse } from "~/api/generated-api";

type CourseStatisticsPanelProps = {
  courseStatistics?: GetCourseStatisticsResponse["data"];
  isLoading: boolean;
};

export default function CourseStatisticsPanel({
  courseStatistics,
  isLoading,
}: CourseStatisticsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-gothic text-xl font-bold text-[#363636]">
            {t("modernCourseView.contents.courseStatistics")}
          </h3>
          <p className="mt-1 text-sm text-[#676767]">
            {t("modernCourseView.contents.statisticsDescription")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Users className="h-5 w-5 text-[#3f58b6]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#363636]">
                {isLoading ? "—" : (courseStatistics?.enrolledCount ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-[#676767]">
                {t("modernCourseView.contents.totalStudents")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-[#26b183]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#363636]">
                {isLoading ? "—" : `${Math.round(courseStatistics?.completionPercentage ?? 0)}%`}
              </p>
              <p className="text-xs text-[#676767]">
                {t("modernCourseView.contents.completionRate")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#363636]">
                {isLoading ? "—" : formatDuration(courseStatistics?.averageSeconds ?? 0)}
              </p>
              <p className="text-xs text-[#676767]">{t("modernCourseView.contents.averageTime")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100">
              <BarChart2 className="size-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#363636]">4.7</p>
              <p className="text-xs text-[#676767]">
                {t("modernCourseView.contents.averageRating")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
            <BarChart2 className="h-8 w-8 text-gray-400" />
          </div>
          <h4 className="mb-2 text-lg font-semibold text-[#363636]">
            {t("modernCourseView.contents.detailedStatisticsSoon")}
          </h4>
          <p className="mx-auto max-w-md text-sm text-[#676767]">
            {t("modernCourseView.contents.detailedStatisticsDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
