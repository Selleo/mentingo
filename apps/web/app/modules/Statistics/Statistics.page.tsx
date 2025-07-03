import { useUserRole } from "~/hooks/useUserRole";

import { AdminStatistics } from "./Admin/AdminStatistics";
import ClientStatistics from "./Client/ClientStatistics";

export default function StatisticsPage() {
  const { isAdmin, isContentCreator } = useUserRole();

  if (isAdmin || isContentCreator) {
    return <AdminStatistics />;
  }

  return <ClientStatistics />;
}
