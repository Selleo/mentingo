import { Navigate } from "@remix-run/react";

import { useUserRole } from "~/hooks/useUserRole";

import { LOGIN_REDIRECT_URL } from "../Auth/constants";

export default function IndexRedirectPage() {
  const { isAdminLike, isStudent } = useUserRole();

  if (isAdminLike || isStudent) {
    return <Navigate to={LOGIN_REDIRECT_URL} replace />;
  }

  return <Navigate to="/auth/login" replace />;
}
