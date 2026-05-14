import { useTranslation } from "react-i18next";

import { PageWrapper } from "~/components/PageWrapper";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../../e2e/data/learning-paths/handles";

import { AdminLearningPathsHeader } from "./AdminLearningPathsHeader";
import { AdminLearningPathsList } from "./AdminLearningPathsList";

export function AdminLearningPathsPageContent() {
  const { t } = useTranslation();

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminLearningPathsView.breadcrumbs.learningPaths"),
          href: "/learning-paths",
        },
      ]}
    >
      <section
        className="flex flex-col gap-6 md:gap-8"
        data-testid={LEARNING_PATHS_PAGE_HANDLES.ADMIN_PAGE}
      >
        <AdminLearningPathsHeader />
        <AdminLearningPathsList />
      </section>
    </PageWrapper>
  );
}
