import { Navigate } from "@remix-run/react";

import { useCurrentUserSuspense } from "~/api/queries";
import { useGlobalSettingsSuspense } from "~/api/queries/useGlobalSettings";
import { getDefaultAuthenticatedRedirect } from "~/utils/getDefaultAuthenticatedRedirect";

export default function IndexRedirectPage() {
  const { data: currentUser } = useCurrentUserSuspense();
  const { data: globalSettings } = useGlobalSettingsSuspense();

  return <Navigate to={getDefaultAuthenticatedRedirect(currentUser, globalSettings)} replace />;
}
