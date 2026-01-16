import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const LOGIN_PAGE_FILES_QUERY_KEY = ["login-page-files"] as const;

export const loginPageFilesQueryOptions = () =>
  queryOptions({
    queryKey: LOGIN_PAGE_FILES_QUERY_KEY,
    queryFn: async () => {
      const response = await ApiClient.api.settingsControllerGetLoginPageFiles();

      return response.data;
    },
  });

export default function useLoginPageFiles() {
  return useQuery(loginPageFilesQueryOptions());
}
