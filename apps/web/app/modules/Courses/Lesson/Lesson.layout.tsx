import { useCurrentUser } from "~/api/queries";
import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { queryClient } from "~/api/queryClient";
import { Dashboard } from "~/modules/Dashboard/Dashboard";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = () => {
  const companyShortName = queryClient.getQueryData(companyInformationQueryOptions.queryKey)?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - Lesson` : "Lesson";

  return [{ title }];
};

export default function LessonLayout() {
  const { data: user } = useCurrentUser();

  return <Dashboard isAuthenticated={Boolean(user)} />;
}
