import { Navigate, useLocation } from "@remix-run/react";
import { match } from "ts-pattern";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";
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

  if (isLoading) {
    return null;
  }

  const shouldVerifyMFA = Boolean(currentUser?.shouldVerifyMFA);
  const isMFAComplete = !shouldVerifyMFA || hasVerifiedMFA;

  return match(mode)
    .with("auth", () => {
      if (!currentUser) {
        return children;
      }

      if (shouldVerifyMFA && location.pathname !== "/auth/mfa") {
        return <Navigate to="/auth/mfa" />;
      }

      if (!shouldVerifyMFA) {
        return <Navigate to={LOGIN_REDIRECT_URL} />;
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
