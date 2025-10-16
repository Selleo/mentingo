import { useUserRole } from "~/hooks/useUserRole";
import { setPageTitle } from "~/utils/setPageTitle";

import { AdminStatistics } from "./Admin/AdminStatistics";
import ClientStatistics from "./Client/ClientStatistics";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.dashboard");

export default function StatisticsPage() {
  const { isAdminLike } = useUserRole();

  if (isAdminLike) {
    return <AdminStatistics />;
  }

  return <ClientStatistics />;
}
