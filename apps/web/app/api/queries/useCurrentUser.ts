import { useLocation } from "@remix-run/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { USER_ROLE } from "~/config/userRoles";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";

import type { CurrentUserResponse } from "../generated-api";

export const currentUserQueryOptions = {
  queryKey: ["currentUser"],
  queryFn: async () => {
    const response = await ApiClient.api.authControllerCurrentUser();
    return response.data;
  },
  select: (data: CurrentUserResponse) => data.data,
};

// export function useCurrentUser() {
//   const { currentUser } = useCurrentUserStore();

//   const query = useQuery({
//     ...currentUserQueryOptions,
//     enabled: currentUser?.role !== USER_ROLE.visitor,
//   });

//   return {
//     ...query,
//     data: query.data ?? { role: USER_ROLE.visitor },
//   };
// }

export function useCurrentUserSuspense() {
  return useSuspenseQuery(currentUserQueryOptions);
}

export function useCurrentUser() {
  const location = useLocation();
  const isVisitorRoute = location.pathname === "/visitor-courses";

  const query = useQuery({
    ...currentUserQueryOptions,
    enabled: !isVisitorRoute, // Don't fetch if on visitor route
  });

  return {
    ...query,
    data: isVisitorRoute
      ? { role: USER_ROLE.visitor }
      : (query.data ?? { role: USER_ROLE.visitor }),
  };
}
