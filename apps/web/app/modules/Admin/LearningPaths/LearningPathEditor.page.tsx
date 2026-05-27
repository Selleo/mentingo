import { useLoaderData, useLocation, useParams } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { learningPathQueryOptions, useLearningPath } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import { getLocalizedResourceLanguage } from "~/components/LanguageSelector/utils";
import { PageWrapper } from "~/components/PageWrapper";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { LearningPathEditorForm } from "./components/LearningPathEditorForm";

import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";
import type { SupportedLanguages } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.adminLearningPathEditor");

export const clientLoader = async ({ params }: ClientLoaderFunctionArgs) => {
  if (!params.id || params.id === "new") return null;

  const { language } = useLanguageStore.getState();

  return queryClient.fetchQuery(learningPathQueryOptions(params.id, { language }));
};

export default function LearningPathEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { pathname } = useLocation();

  const loaderLearningPath = useLoaderData<typeof clientLoader>();

  const { permissions } = usePermissions();
  const { data: currentUser } = useCurrentUserSuspense();

  const isCreateMode = pathname.endsWith("/admin/learning-paths/new");
  const appLanguage = useLanguageStore((state) => state.language);

  const [editorLanguage, setEditorLanguage] = useState<SupportedLanguages>(
    loaderLearningPath?.data.baseLanguage ?? appLanguage,
  );

  const { data: learningPathResponse } = useLearningPath(
    id ?? "",
    { language: editorLanguage },
    { enabled: Boolean(id) && !isCreateMode },
  );

  const effectiveLearningPath = learningPathResponse?.data ?? loaderLearningPath?.data ?? null;

  const { effectiveLanguage, formKey, selectorProps } = getLocalizedResourceLanguage({
    value: editorLanguage,
    onChange: setEditorLanguage,
    baseLanguage: effectiveLearningPath?.baseLanguage,
    availableLocales: effectiveLearningPath?.availableLocales,
    formKeyParts: [
      id ?? "new",
      effectiveLearningPath?.title ?? "",
      effectiveLearningPath?.description ?? "",
    ],
  });

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminLearningPathsView.breadcrumbs.learningPaths"),
          href: "/admin/learning-paths",
        },
        {
          title: isCreateMode
            ? t("adminLearningPathsView.breadcrumbs.create")
            : t("adminLearningPathsView.breadcrumbs.edit"),
          href: isCreateMode ? "/admin/learning-paths/new" : `/admin/learning-paths/${id}`,
        },
      ]}
    >
      <LearningPathEditorForm
        key={formKey}
        currentUserId={currentUser?.id}
        editorLanguage={effectiveLanguage}
        formKey={formKey}
        id={id}
        isCreateMode={isCreateMode}
        languageSelectorProps={selectorProps}
        learningPath={effectiveLearningPath}
        permissions={permissions}
      />
    </PageWrapper>
  );
}
