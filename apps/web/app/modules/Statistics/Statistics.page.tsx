import { useUserRole } from "~/hooks/useUserRole";

import { AdminStatistics } from "./Admin/AdminStatistics";
import ClientStatistics from "./Client/ClientStatistics";

export default function StatisticsPage() {
  const { isAdminLike } = useUserRole();

  if (isAdminLike) {
    return <AdminStatistics />;
  }

  return <ClientStatistics />;
}
