import { useTranslation } from "react-i18next";

import { Card, CardContent } from "~/components/ui/card";

type CourseDiscussionProps = {
  isEnrolled: boolean;
};

export function CourseDiscussion({ isEnrolled }: CourseDiscussionProps) {
  const { t } = useTranslation();

  if (!isEnrolled) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="body-base-md text-neutral-900">
            {t("studentCourseView.discussion.enrollmentRequired")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <p className="body-base-md text-neutral-900">{t("studentCourseView.discussion.empty")}</p>
      </CardContent>
    </Card>
  );
}
