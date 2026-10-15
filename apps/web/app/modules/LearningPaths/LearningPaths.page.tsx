import { Navigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { usePublicGlobalSettingsSuspense } from "~/api/queries/usePublicGlobalSettingsSuspense";
import { hasAnyPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";
import { usePermissions } from "~/hooks/usePermissions";
import AdminLearningPathsPage from "~/modules/Admin/LearningPaths/LearningPaths.page";
import { setPageTitle } from "~/utils/setPageTitle";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../e2e/data/learning-paths/handles";
import { LOGIN_REDIRECT_URL } from "../Auth/constants";

import { LearningPathsEmptyState } from "./components/LearningPathsEmptyState";
import { LearningPathsPageHeader } from "./components/LearningPathsPageHeader";
import { StudentLearningPathCard } from "./components/StudentLearningPathCard";
import { useStudentLearningPathsPage } from "./hooks/useStudentLearningPathsPage";
import { getLearningPathViewerAccess } from "./utils/learningPathViewerAccess";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.learningPaths");

function StudentLearningPathsPage({
  canSelfEnroll,
  showCourseProgress,
}: {
  canSelfEnroll: boolean;
  showCourseProgress: boolean;
}) {
  const { t } = useTranslation();
  const { language, learningPaths, enrollLearningPath, isEnrollPending } =
    useStudentLearningPathsPage();

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("learningPathsView.breadcrumbs.learningPaths"),
          href: "/development-paths",
        },
      ]}
    >
      <section
        className="flex flex-col gap-6 md:gap-8"
        data-testid={LEARNING_PATHS_PAGE_HANDLES.PAGE}
      >
        <LearningPathsPageHeader />

        <div className="flex flex-col gap-4">
          {learningPaths.data.map((learningPath) => (
            <StudentLearningPathCard
              key={learningPath.id}
              learningPath={learningPath}
              language={language}
              isPending={isEnrollPending}
              onEnroll={enrollLearningPath}
              canSelfEnroll={canSelfEnroll}
              showCourseProgress={showCourseProgress}
            />
          ))}
        </div>

        {!learningPaths.data.length && <LearningPathsEmptyState />}
      </section>
    </PageWrapper>
  );
}

function LearningPathsPageContent() {
  const { permissions } = usePermissions();
  const { data: globalSettings } = usePublicGlobalSettingsSuspense();

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

  if (globalSettings?.learningPathsEnabled === false) {
    return <Navigate to={LOGIN_REDIRECT_URL} replace />;
  }

  return canAccessLearningPathAdmin ? (
    <AdminLearningPathsPage />
  ) : (
    <StudentLearningPathsPage {...getLearningPathViewerAccess(permissions)} />
  );
}

export default function LearningPathsPage() {
  return (
    <RequireAuthenticatedUser>
      <LearningPathsPageContent />
    </RequireAuthenticatedUser>
  );
}
