import { useTranslation } from "react-i18next";

import { useDiscussions } from "~/api/queries/useDiscussions";

export function CourseDiscussions({ courseId }: { courseId: string }) {
  const { t } = useTranslation();
  const { data: threads, isLoading } = useDiscussions(courseId);

  if (isLoading) {
    return (
      <div data-testid="discussions-loading">{t("studentCourseView.discussions.loading")}</div>
    );
  }

  if (!threads?.length) {
    return <div data-testid="discussions-empty">{t("studentCourseView.discussions.empty")}</div>;
  }

  // TODO: next slice - thread list, create/edit forms, thread detail UI
  return <div data-testid="discussions-list">{threads.length}</div>;
}
