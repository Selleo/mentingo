import { Navigate, useLocation, useNavigate } from "@remix-run/react";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { useEffect } from "react";
import { match } from "ts-pattern";

import { useAuthSession } from "~/api/queries/useAuthSession";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { LOGIN_URL, MFA_URL, REQUIRED_PASSWORD_CHANGE_URL } from "~/modules/Auth/constants";
import { courseReturnPath } from "~/modules/Auth/utils/courseReturnPath";
import { resolvePostAuthRedirectPath } from "~/modules/Auth/utils/resolvePostAuthRedirectPath";

import type React from "react";

type MFAGuardProps = {
  children: React.ReactElement;
  mode: "auth" | "app" | "public";
};

export const MFAGuard = ({ children, mode }: MFAGuardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: session, isLoading: isSessionLoading, error: sessionError } = useAuthSession();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);
  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );
  const requestedReturnTo = new URLSearchParams(location.search).get("returnTo");
  const oauthReturnTo =
    location.pathname === LOGIN_URL && requestedReturnTo?.startsWith("/api/oauth/authorize?")
      ? requestedReturnTo
      : null;

  const shouldVerifyMFA = session?.status === AUTH_SESSION_STATUS.MFA_REQUIRED;
  const requiresPasswordChange = Boolean(currentUser?.requiresPasswordChange);
  const requestedCourse = mode === "auth" ? courseReturnPath(location.search) : null;
  const redirectPath = resolvePostAuthRedirectPath({
    pathname: oauthReturnTo ?? requestedCourse ?? lastEntry?.pathname,
  });

  useEffect(() => {
    if (!requestedCourse || lastEntry?.pathname === requestedCourse) return;
    addLastUnauthorizedEntry({ pathname: requestedCourse, timestamp: Date.now() });
  }, [addLastUnauthorizedEntry, lastEntry?.pathname, requestedCourse]);

  useEffect(() => {
    if (mode !== "auth" || !currentUser || shouldVerifyMFA || requiresPasswordChange) return;

    if (redirectPath.startsWith("/api/oauth/authorize?")) {
      window.location.assign(redirectPath);
      return;
    }
    navigate(redirectPath, { replace: true });
  }, [currentUser, mode, navigate, redirectPath, requiresPasswordChange, shouldVerifyMFA]);

  if (sessionError && session === undefined) throw sessionError;

  if (isSessionLoading || isUserLoading) {
    return null;
  }

  if (shouldVerifyMFA) {
    if (location.pathname === MFA_URL) return children;

    return (
      <Navigate
        to={oauthReturnTo ? `${MFA_URL}?returnTo=${encodeURIComponent(oauthReturnTo)}` : MFA_URL}
      />
    );
  }

  return match(mode)
    .with("auth", () => {
      if (!currentUser) {
        return children;
      }

      if (requiresPasswordChange && location.pathname !== REQUIRED_PASSWORD_CHANGE_URL) {
        return <Navigate to={REQUIRED_PASSWORD_CHANGE_URL} />;
      }

      if (!requiresPasswordChange) {
        return null;
      }

      return children;
    })
    .with("public", () => {
      if (requiresPasswordChange) {
        return <Navigate to={REQUIRED_PASSWORD_CHANGE_URL} />;
      }

      return children;
    })
    .with("app", () => {
      if (!currentUser) {
        return <Navigate to={LOGIN_URL} />;
      }

      if (requiresPasswordChange) {
        return <Navigate to={REQUIRED_PASSWORD_CHANGE_URL} />;
      }

      return children;
    })
    .exhaustive();
};
