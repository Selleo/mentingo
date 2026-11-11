import { Navigate, useNavigate, useSearchParams } from "@remix-run/react";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { useEffect } from "react";

import { useMfaChallenge } from "~/api/mutations/useMfaChallenge";
import { authSessionQueryOptions, useAuthSession } from "~/api/queries/useAuthSession";
import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";

import Loader from "../common/Loader/Loader";

import { SetupMFACard, VerifyMFACard } from "./components";
import { LOGIN_URL } from "./constants";
import { resolvePostAuthRedirectPath } from "./utils/resolvePostAuthRedirectPath";

export default function MFAPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: session, isLoading } = useAuthSession();
  const { mutate: startChallenge, isSuccess, isError } = useMfaChallenge();
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);

  const isAuthenticated = session?.status === AUTH_SESSION_STATUS.AUTHENTICATED;
  const requestedReturnTo = searchParams.get("returnTo");
  const redirectPath = resolvePostAuthRedirectPath({
    pathname: requestedReturnTo?.startsWith("/api/oauth/authorize?")
      ? requestedReturnTo
      : lastEntry?.pathname,
  });

  const isAwaitingMfa = session?.status === AUTH_SESSION_STATUS.MFA_REQUIRED;

  useEffect(() => {
    if (isAwaitingMfa) startChallenge();
  }, [isAwaitingMfa, startChallenge]);

  useEffect(() => {
    if (!session?.expiresAt) return;

    const timer = window.setTimeout(
      () => {
        queryClient.setQueryData(authSessionQueryOptions.queryKey, null);
        queryClient.setQueryData(currentUserQueryOptions.queryKey, null);
      },
      Math.max(0, session.expiresAt * 1000 - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session?.expiresAt]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (redirectPath.startsWith("/api/oauth/authorize?")) {
      window.location.assign(redirectPath);
      return;
    }
    navigate(redirectPath, { replace: true });
  }, [isAuthenticated, navigate, redirectPath]);

  if ((!isLoading && !session) || isError) return <Navigate to={LOGIN_URL} />;

  if (isAuthenticated) return null;

  if (isLoading || !isSuccess) {
    return (
      <div className="grid h-full w-full place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {session?.setupRequired ? <SetupMFACard /> : <VerifyMFACard />}
    </div>
  );
}
