import { createContext, useContext } from "react";

const DashboardEditContext = createContext(false);

export function DashboardEditModeProvider({
  children,
  isEditing,
}: {
  children: React.ReactNode;
  isEditing: boolean;
}) {
  return (
    <DashboardEditContext.Provider value={isEditing}>{children}</DashboardEditContext.Provider>
  );
}

export function useDashboardEditMode() {
  return useContext(DashboardEditContext);
}
