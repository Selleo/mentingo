import { redirect, useLoaderData } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useEnrollCurrentUserToLearningPath } from "~/api/mutations/useLearningPathMutations";
import { currentUserQueryOptions } from "~/api/queries";
import { learningPathsQueryOptions, useLearningPaths } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import { hasAnyPermission } from "~/common/permissions/permission.utils";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Input } from "~/components/ui/input";
import { useToast } from "~/components/ui/use-toast";
import { usePermissions } from "~/hooks/usePermissions";
import AdminLearningPathsPage from "~/modules/Admin/LearningPaths/LearningPaths.page";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";
import { setPageTitle } from "~/utils/setPageTitle";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../e2e/data/learning-paths/handles";

import { InlineLearningPathCard } from "./components/InlineLearningPathCard";

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
  const loaderLearningPaths = useLoaderData<typeof clientLoader>();
  const { toast } = useToast();
  const { language } = useLanguageStore.getState();
  const [searchValue, setSearchValue] = useState("");
  const { data: learningPaths = loaderLearningPaths } = useLearningPaths({
    language,
    searchQuery: searchValue.trim() || undefined,
  });
  const { mutateAsync: enrollCurrentUserToLearningPath, isPending: isEnrollPending } =
    useEnrollCurrentUserToLearningPath();

  const handleEnrollLearningPath = async (learningPathId: string) => {
    await enrollCurrentUserToLearningPath(learningPathId);
    await queryClient.invalidateQueries({ queryKey: ["learning-paths"] });
    toast({
      description: t("learningPathsView.enrollment.enrolledSuccessfully"),
    });
  };

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col lg:p-0">
            <h4
              className="h4 pb-1 text-neutral-950"
              data-testid={LEARNING_PATHS_PAGE_HANDLES.HEADING}
            >
              {t("learningPathsView.title")}
            </h4>
            <p className="body-lg-md text-neutral-800">{t("learningPathsView.description")}</p>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t("learningPathsView.searchPlaceholder")}
              className="h-10 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {learningPaths.data.map((learningPath) => (
            <InlineLearningPathCard
              key={learningPath.id}
              learningPath={learningPath}
              canEdit={false}
              canUpdateCourses={false}
              canDelete={false}
              canManageEnrollment={false}
              groupOptions={[]}
              currentLanguage={language}
              selectedLanguage={language}
              onLanguageChange={() => undefined}
              onUpdate={async () => undefined}
              onDelete={() => undefined}
              onAddCourses={async () => undefined}
              onRemoveCourse={async () => undefined}
              onReorderCourses={async () => undefined}
              onEnrollCurrentUser={() => handleEnrollLearningPath(learningPath.id)}
              isPending={isEnrollPending}
              showCertificate
            />
          ))}
        </div>

        {!learningPaths.data.length && (
          <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-neutral-50 p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <Icon name="EmptyCourse" className="text-neutral-900" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-lg font-semibold leading-6 text-neutral-950">
                  {t("learningPathsView.empty.title")}
                </p>
                <p className="text-base leading-6 text-neutral-700">
                  {t("learningPathsView.empty.description")}
                </p>
              </div>
            </div>
          </div>
        )}
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
