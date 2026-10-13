import { useLocation, useParams } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { useLearningPathSuspense } from "~/api/queries/useLearningPaths";
import { getLocalizedResourceLanguage } from "~/components/LanguageSelector/utils";
import { PageWrapper } from "~/components/PageWrapper";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { LearningPathEditorForm } from "./components/LearningPathEditorForm";

import type { LearningPathEditorLearningPath } from "./types";
import type { MetaFunction } from "@remix-run/react";
import type { SupportedLanguages } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.adminLearningPathEditor");

function LearningPathEditor({
  id,
  learningPath,
}: {
  id?: string;
  learningPath: LearningPathEditorLearningPath | null;
}) {
  const appLanguage = useLanguageStore((state) => state.language);

  const [editorLanguage, setEditorLanguage] = useState<SupportedLanguages>(
    learningPath?.baseLanguage ?? appLanguage,
  );

  return learningPath && id ? (
    <LocalizedLearningPathEditor
      id={id}
      editorLanguage={editorLanguage}
      setEditorLanguage={setEditorLanguage}
    />
  ) : (
    <LearningPathEditorContent
      id={id}
      learningPath={learningPath}
      editorLanguage={editorLanguage}
      setEditorLanguage={setEditorLanguage}
    />
  );
}

function LocalizedLearningPathEditor({
  id,
  editorLanguage,
  setEditorLanguage,
}: {
  id: string;
  editorLanguage: SupportedLanguages;
  setEditorLanguage: (language: SupportedLanguages) => void;
}) {
  const { data: learningPath } = useLearningPathSuspense(id, { language: editorLanguage });

  return (
    <LearningPathEditorContent
      id={id}
      learningPath={learningPath.data}
      editorLanguage={editorLanguage}
      setEditorLanguage={setEditorLanguage}
    />
  );
}

function LearningPathEditorContent({
  id,
  learningPath,
  editorLanguage,
  setEditorLanguage,
}: {
  id?: string;
  learningPath: LearningPathEditorLearningPath | null;
  editorLanguage: SupportedLanguages;
  setEditorLanguage: (language: SupportedLanguages) => void;
}) {
  const { t } = useTranslation();
  const { permissions } = usePermissions();
  const { data: currentUser } = useCurrentUserSuspense();
  const isCreateMode = learningPath === null;

  const { effectiveLanguage, formKey, selectorProps } = getLocalizedResourceLanguage({
    value: editorLanguage,
    onChange: setEditorLanguage,
    baseLanguage: learningPath?.baseLanguage,
    availableLocales: learningPath?.availableLocales,
    formKeyParts: [id ?? "new", learningPath?.title ?? "", learningPath?.description ?? ""],
  });

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminLearningPathsView.breadcrumbs.learningPaths"),
          href: "/admin/development-paths",
        },
        {
          title: isCreateMode
            ? t("adminLearningPathsView.breadcrumbs.create")
            : t("adminLearningPathsView.breadcrumbs.edit"),
          href: isCreateMode ? "/admin/development-paths/new" : `/admin/development-paths/${id}`,
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
        learningPath={learningPath}
        permissions={permissions}
      />
    </PageWrapper>
  );
}

function ExistingLearningPathEditor({ id }: { id: string }) {
  const language = useLanguageStore((state) => state.language);
  const { data: learningPath } = useLearningPathSuspense(id, { language });

  return <LearningPathEditor key={id} id={id} learningPath={learningPath.data} />;
}

function LearningPathEditorRoute() {
  const { id } = useParams();
  const { pathname } = useLocation();

  if (!id || pathname.endsWith("/admin/development-paths/new")) {
    return <LearningPathEditor learningPath={null} />;
  }

  return <ExistingLearningPathEditor id={id} />;
}

export default function LearningPathEditorPage() {
  return (
    <RequireAuthenticatedUser>
      <LearningPathEditorRoute />
    </RequireAuthenticatedUser>
  );
}
