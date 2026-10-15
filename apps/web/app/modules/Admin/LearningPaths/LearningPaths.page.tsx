import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";
import { setPageTitle } from "~/utils/setPageTitle";

import { AdminLearningPathsPageContent } from "./components/AdminLearningPathsPageContent";
import { AdminLearningPathsPageProvider } from "./context/AdminLearningPathsPageContext";
import { useAdminLearningPathsPage } from "./hooks/useAdminLearningPathsPage";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.adminLearningPaths");

function AuthenticatedAdminLearningPathsPage() {
  const page = useAdminLearningPathsPage();

  return (
    <AdminLearningPathsPageProvider value={page}>
      <AdminLearningPathsPageContent />
    </AdminLearningPathsPageProvider>
  );
}

export default function AdminLearningPathsPage() {
  return (
    <RequireAuthenticatedUser>
      <AuthenticatedAdminLearningPathsPage />
    </RequireAuthenticatedUser>
  );
}
