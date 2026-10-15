import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export type LoginMethod = "google" | "microsoft" | "slack" | "magicLink" | "password";
export type LoginMethods = Record<LoginMethod, boolean>;
export type LoginMethodSetup = {
  methods: LoginMethods;
  missing: Record<"google" | "microsoft" | "slack", string[]>;
};
export function useLoginMethods() {
  return useQuery({
    queryKey: ["loginMethods"],
    staleTime: 0,
    queryFn: async () =>
      (await ApiClient.instance.get<{ data: LoginMethods }>("/api/env/login-methods")).data.data,
  });
}
