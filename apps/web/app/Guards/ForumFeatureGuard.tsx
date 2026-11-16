import { Navigate } from "@remix-run/react";
import { Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { PageWrapper } from "~/components/PageWrapper";
import Loader from "~/modules/common/Loader/Loader";

type ForumFeatureGuardProps = {
  children: ReactNode;
};

export const ForumFeatureGuard = ({ children }: ForumFeatureGuardProps) => {
  const { t } = useTranslation();
  const { data: globalSettings, isPending, error } = useGlobalSettings();
  const loader = (
    <PageWrapper>
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    </PageWrapper>
  );

  return match({
    isPending,
    hasError: Boolean(error),
    isEnabled: globalSettings?.forumEnabled === true,
  })
    .with({ isPending: true }, () => loader)
    .with({ hasError: true }, () => (
      <ErrorPage
        title={getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong"))}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
      />
    ))
    .with({ isEnabled: false }, () => <Navigate to="/" replace />)
    .otherwise(() => <Suspense fallback={loader}>{children}</Suspense>);
};
