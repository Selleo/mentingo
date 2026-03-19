import { Navigate, useLocation } from "@remix-run/react";
import { useEffect, useMemo } from "react";
import { match } from "ts-pattern";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";
import { resolvePostAuthRedirectPath } from "~/modules/Auth/utils/resolvePostAuthRedirectPath";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type React from "react";

type MFAGuardProps = {
  children: React.ReactElement;
  mode: "auth" | "app" | "public";
};

export const MFAGuard = ({ children, mode }: MFAGuardProps) => {
  const location = useLocation();
  const { data: currentUser, isLoading } = useCurrentUser();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);
  const getLastEntry = useNavigationHistoryStore((state) => state.getLastEntry);
  const mergeNavigationHistory = useNavigationHistoryStore((state) => state.mergeNavigationHistory);
  const clearHistory = useNavigationHistoryStore((state) => state.clearHistory);

  const shouldVerifyMFA = Boolean(currentUser?.shouldVerifyMFA);
  const isMFAComplete = !shouldVerifyMFA || hasVerifiedMFA;
  const redirectPath = useMemo(() => {
    mergeNavigationHistory();

    return resolvePostAuthRedirectPath({ pathname: getLastEntry()?.pathname });
  }, [getLastEntry, mergeNavigationHistory]);

  useEffect(() => {
    if (mode !== "auth" || !currentUser || shouldVerifyMFA) return;

    clearHistory();
  }, [clearHistory, currentUser, mode, shouldVerifyMFA]);

  if (isLoading) {
    return null;
  }

  return match(mode)
    .with("auth", () => {
      if (!currentUser) {
        return children;
      }

      if (shouldVerifyMFA && location.pathname !== "/auth/mfa") {
        return <Navigate to="/auth/mfa" />;
      }

      if (!shouldVerifyMFA) {
        return <Navigate to={redirectPath || LOGIN_REDIRECT_URL} />;
      }

      return children;
    })
    .with("public", () => {
      if (shouldVerifyMFA && !hasVerifiedMFA) {
        return <Navigate to="/auth/mfa" />;
      }

      return children;
    })
    .with("app", () => {
      if (!currentUser) {
        return <Navigate to="/auth/login" />;
      }

      if (!isMFAComplete) {
        return <Navigate to="/auth/mfa" />;
      }

      return children;
    })
    .exhaustive();
};
