import { setPageTitle } from "~/utils/setPageTitle";

import { AdminStatistics } from "./Admin/AdminStatistics";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.analytics");

export default function AnalyticsPage() {
  return <AdminStatistics />;
}
