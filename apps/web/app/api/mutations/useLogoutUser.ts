import { useNavigate } from "@remix-run/react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { requestManager, ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

import { useAuthStore } from "./../../modules/Auth/authStore";

export function useLogoutUser() {
  const { toast } = useToast();
  const { setLoggedIn } = useAuthStore();
  const setCurrentUser = useCurrentUserStore((state) => state.setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.authControllerLogout();

      setCurrentUser(undefined);
      setLoggedIn(false);
      setHasVerifiedMFA(false);

      return response.data;
    },
    onSuccess: () => {
      requestManager.abortAll();

      queryClient.invalidateQueries();

      navigate("/auth/login");
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
