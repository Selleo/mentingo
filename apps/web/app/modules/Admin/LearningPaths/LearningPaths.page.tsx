import { learningPathsQueryOptions } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { AdminLearningPathsPageContent } from "./components/AdminLearningPathsPageContent";
import { AdminLearningPathsPageProvider } from "./context/AdminLearningPathsPageContext";
import { useAdminLearningPathsPage } from "./hooks/useAdminLearningPathsPage";

import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.adminLearningPaths");

export const clientLoader = async (_: ClientLoaderFunctionArgs) => {
  const { language } = useLanguageStore.getState();

  return queryClient.fetchQuery(learningPathsQueryOptions({ language }));
};

export default function AdminLearningPathsPage() {
  const page = useAdminLearningPathsPage();

  return (
    <AdminLearningPathsPageProvider value={page}>
      <AdminLearningPathsPageContent />
    </AdminLearningPathsPageProvider>
  );
}
