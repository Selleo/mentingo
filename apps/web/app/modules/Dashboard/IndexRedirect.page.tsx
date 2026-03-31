import { Navigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";

import { usePermissions } from "~/hooks/usePermissions";

import { LOGIN_REDIRECT_URL } from "../Auth/constants";

export default function IndexRedirectPage() {
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });

  if (canManageCourses || canUpdateLearningProgress) {
    return <Navigate to={LOGIN_REDIRECT_URL} replace />;
  }

  return <Navigate to="/auth/login" replace />;
}
