import { Navigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { PageWrapper } from "~/components/PageWrapper";
import Loader from "~/modules/common/Loader/Loader";
import { areLeaderboardsEnabled } from "~/modules/Gamification/Leaderboard/leaderboard.utils";

import {
  GAMIFICATION_FEATURES,
  type GamificationFeature,
} from "./GamificationFeatureGuard.constants";

import type { ReactNode } from "react";
import type { GlobalSettings } from "~/modules/Dashboard/Settings/types";

type GamificationFeatureGuardProps = {
  children: ReactNode;
  feature: GamificationFeature;
};

const isGamificationFeatureEnabled = (
  feature: GamificationFeature,
  globalSettings: GlobalSettings | undefined,
) =>
  match(feature)
    .with(GAMIFICATION_FEATURES.GAMIFICATION, () => globalSettings?.gamificationEnabled === true)
    .with(GAMIFICATION_FEATURES.LEADERBOARDS, () => areLeaderboardsEnabled(globalSettings))
    .exhaustive();

/**
 * Renders gamification pages only while the feature is switched on in platform settings,
 * so the page's own queries never mount for a disabled organization.
 */
export const GamificationFeatureGuard = ({ children, feature }: GamificationFeatureGuardProps) => {
  const { t } = useTranslation();
  const { data: globalSettings, isPending, error } = useGlobalSettings();
  const isEnabled = isGamificationFeatureEnabled(feature, globalSettings);

  return match({ isPending, hasError: Boolean(error), isEnabled })
    .with({ isPending: true }, () => (
      <PageWrapper>
        <div className="flex h-full items-center justify-center">
          <Loader />
        </div>
      </PageWrapper>
    ))
    .with({ hasError: true }, () => (
      <ErrorPage
        title={getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong"))}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
      />
    ))
    .with({ isEnabled: false }, () => <Navigate to="/" replace />)
    .otherwise(() => <>{children}</>);
};
