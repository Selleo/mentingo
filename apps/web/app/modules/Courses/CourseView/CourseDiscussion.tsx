import { useTranslation } from "react-i18next";

import { useCourseDiscussionSummary } from "~/api/queries/useCourseDiscussionSummary";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent } from "~/components/ui/card";

type CourseDiscussionProps = {
  courseId: string;
  isEnrolled: boolean;
};

export function CourseDiscussion({ courseId, isEnrolled }: CourseDiscussionProps) {
  const { t } = useTranslation();
  const { data: summary } = useCourseDiscussionSummary(courseId);

  const completedCount = summary?.completedCount ?? 0;
  const visibleAvatars = summary?.completedStudentAvatars ?? [];
  const extraCompletedCount = Math.max(completedCount - visibleAvatars.length, 0);

  if (!isEnrolled) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <p className="body-sm text-neutral-700 mb-3">
              {t("studentCourseView.discussion.completed")}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {visibleAvatars.map((avatarUrl, index) => (
                  <Avatar
                    key={`${avatarUrl}-${index}`}
                    className="size-8 border-2 border-background"
                  >
                    <AvatarImage
                      src={avatarUrl}
                      alt={t("studentCourseView.discussion.avatarAlt")}
                    />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="body-base-md text-neutral-900">
                +{extraCompletedCount > 0 ? extraCompletedCount : completedCount}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="body-base-md text-neutral-900">
              {t("studentCourseView.discussion.enrollmentRequired")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <p className="body-sm text-neutral-700 mb-3">
            {t("studentCourseView.discussion.completed")}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {visibleAvatars.map((avatarUrl, index) => (
                <Avatar key={`${avatarUrl}-${index}`} className="size-8 border-2 border-background">
                  <AvatarImage src={avatarUrl} alt={t("studentCourseView.discussion.avatarAlt")} />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="body-base-md text-neutral-900">
              +{extraCompletedCount > 0 ? extraCompletedCount : completedCount}
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="body-base-md text-neutral-900">{t("studentCourseView.discussion.empty")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
