import { Navigate, useLocation, useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { match } from "ts-pattern";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { REQUIRED_PASSWORD_CHANGE_URL } from "~/modules/Auth/constants";
import { resolvePostAuthRedirectPath } from "~/modules/Auth/utils/resolvePostAuthRedirectPath";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type React from "react";

type MFAGuardProps = {
  children: React.ReactElement;
  mode: "auth" | "app" | "public";
};

export const MFAGuard = ({ children, mode }: MFAGuardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: currentUser, isLoading } = useCurrentUser();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);

  const shouldVerifyMFA = Boolean(currentUser?.shouldVerifyMFA);
  const isMFAComplete = !shouldVerifyMFA || hasVerifiedMFA;
  const requiresPasswordChange = Boolean(currentUser?.requiresPasswordChange);
  const redirectPath = resolvePostAuthRedirectPath({ pathname: lastEntry?.pathname });

  useEffect(() => {
    if (mode !== "auth" || !currentUser || shouldVerifyMFA) return;

    navigate(redirectPath, { replace: true });
  }, [currentUser, mode, navigate, redirectPath, shouldVerifyMFA]);

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

      if (requiresPasswordChange && location.pathname !== REQUIRED_PASSWORD_CHANGE_URL) {
        return <Navigate to={REQUIRED_PASSWORD_CHANGE_URL} />;
      }

      if (!shouldVerifyMFA && !requiresPasswordChange) {
        return null;
      }

      return children;
    })
    .with("public", () => {
      if (shouldVerifyMFA && !hasVerifiedMFA) {
        return <Navigate to="/auth/mfa" />;
      }

      if (requiresPasswordChange) {
        return <Navigate to={REQUIRED_PASSWORD_CHANGE_URL} />;
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

      if (requiresPasswordChange) {
        return <Navigate to={REQUIRED_PASSWORD_CHANGE_URL} />;
      }

      return children;
    })
    .exhaustive();
};
