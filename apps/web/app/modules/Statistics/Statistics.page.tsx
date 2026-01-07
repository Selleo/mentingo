import { setPageTitle } from "~/utils/setPageTitle";

import ClientStatistics from "./Client/ClientStatistics";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.progress");

export default function StatisticsPage() {
  return <ClientStatistics />;
}
