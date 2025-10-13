import { type MetaFunction, Outlet } from "@remix-run/react";

import { companyInformationQueryOptions } from "~/api/queries/useCompanyInformation";
import { queryClient } from "~/api/queryClient";

export type ParentRouteData = {
  companyInfo: {
    data: {
      companyShortName?: string;
    };
  };
};

export const meta: MetaFunction<typeof clientLoader> = ({ data }) => {
  const companyShortName = data?.companyInfo?.data?.companyShortName;
  const title = companyShortName ? `${companyShortName}` : "Mentingo";

  return [{ title }];
};

export const clientLoader = async () => {
  const companyInfo = await queryClient.ensureQueryData(companyInformationQueryOptions);

  return { companyInfo };
};

export default function Layout() {
  return <Outlet />;
}
