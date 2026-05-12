import { createContext, useContext } from "react";

import type { useAdminLearningPathsPage } from "../hooks/useAdminLearningPathsPage";
import type { PropsWithChildren } from "react";

type AdminLearningPathsPageContextValue = ReturnType<typeof useAdminLearningPathsPage>;

const AdminLearningPathsPageContext = createContext<AdminLearningPathsPageContextValue | null>(
  null,
);

export function AdminLearningPathsPageProvider({
  value,
  children,
}: PropsWithChildren<{ value: AdminLearningPathsPageContextValue }>) {
  return (
    <AdminLearningPathsPageContext.Provider value={value}>
      {children}
    </AdminLearningPathsPageContext.Provider>
  );
}

export function useAdminLearningPathsPageContext() {
  const context = useContext(AdminLearningPathsPageContext);

  if (!context) {
    throw new Error(
      "useAdminLearningPathsPageContext must be used inside AdminLearningPathsPageProvider",
    );
  }

  return context;
}
