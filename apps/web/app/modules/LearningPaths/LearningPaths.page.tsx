import { redirect } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { currentUserQueryOptions } from "~/api/queries";
import { learningPathsQueryOptions } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import { hasAnyPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { usePermissions } from "~/hooks/usePermissions";
import AdminLearningPathsPage from "~/modules/Admin/LearningPaths/LearningPaths.page";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";
import { setPageTitle } from "~/utils/setPageTitle";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../e2e/data/learning-paths/handles";

import { LearningPathsEmptyState } from "./components/LearningPathsEmptyState";
import { LearningPathsPageHeader } from "./components/LearningPathsPageHeader";
import { StudentLearningPathCard } from "./components/StudentLearningPathCard";
import { useStudentLearningPathsPage } from "./hooks/useStudentLearningPathsPage";

import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.learningPaths");

export const clientLoader = async ({ request }: ClientLoaderFunctionArgs) => {
  try {
    const user = await queryClient.ensureQueryData(currentUserQueryOptions);

    if (!user) {
      saveEntryToNavigationHistory(request);

      throw redirect("/auth/login");
    }
  } catch {
    throw redirect("/auth/login");
  }

  const { language } = useLanguageStore.getState();

  return queryClient.fetchQuery(learningPathsQueryOptions({ language }));
};

function StudentLearningPathsPage() {
  const { t } = useTranslation();
  const {
    language,
    learningPaths,
    searchValue,
    setSearchValue,
    enrollLearningPath,
    isEnrollPending,
  } = useStudentLearningPathsPage();

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("learningPathsView.breadcrumbs.learningPaths"),
          href: "/learning-paths",
        },
      ]}
    >
      <section
        className="flex flex-col gap-6 md:gap-8"
        data-testid={LEARNING_PATHS_PAGE_HANDLES.PAGE}
      >
        <LearningPathsPageHeader searchValue={searchValue} onSearchChange={setSearchValue} />

        <div className="flex flex-col gap-4">
          {learningPaths.data.map((learningPath) => (
            <StudentLearningPathCard
              key={learningPath.id}
              learningPath={learningPath}
              language={language}
              isPending={isEnrollPending}
              onEnroll={enrollLearningPath}
            />
          ))}
        </div>

        {!learningPaths.data.length && <LearningPathsEmptyState />}
      </section>
    </PageWrapper>
  );
}

export default function LearningPathsPage() {
  const { permissions } = usePermissions();

  const canAccessLearningPathAdmin = hasAnyPermission(permissions, [
    PERMISSIONS.LEARNING_PATH_CREATE,
    PERMISSIONS.LEARNING_PATH_UPDATE,
    PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
    PERMISSIONS.LEARNING_PATH_COURSE_UPDATE,
    PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
    PERMISSIONS.LEARNING_PATH_DELETE,
    PERMISSIONS.LEARNING_PATH_ENROLLMENT,
    PERMISSIONS.LEARNING_PATH_EXPORT,
  ]);

  return canAccessLearningPathAdmin ? <AdminLearningPathsPage /> : <StudentLearningPathsPage />;
}
