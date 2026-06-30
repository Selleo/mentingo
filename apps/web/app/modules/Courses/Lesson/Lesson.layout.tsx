import { useCurrentUser } from "~/api/queries";
import { Dashboard } from "~/modules/Dashboard/Dashboard";

import type { MetaFunction } from "@remix-run/react";
import type { ParentRouteData } from "~/modules/layout";

export const meta: MetaFunction = ({ matches }) => {
  const parentMatch = matches.find((match) => match.id.includes("layout"));
  const companyShortName = (parentMatch?.data as ParentRouteData)?.companyInfo?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - Lesson` : "Lesson";

  return [{ title }];
};

export default function LessonLayout() {
  const { data: user } = useCurrentUser();

  return <Dashboard isAuthenticated={Boolean(user)} />;
}
