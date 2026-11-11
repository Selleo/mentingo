import { authSessionQueryOptions } from "~/api/queries/useAuthSession";
import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

/**
 * Starts the client session from the server's view of it. Auth responses can describe a session
 * still awaiting MFA, so the user is only marked as logged in once the API returns them.
 */
export async function handleAuthSuccess() {
  await queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] !== authSessionQueryOptions.queryKey[0] &&
      queryKey[0] !== currentUserQueryOptions.queryKey[0],
  });
  queryClient.setQueryData(currentUserQueryOptions.queryKey, null);
  useAuthStore.getState().setLoggedIn(false);
  useCurrentUserStore.getState().setCurrentUser(undefined);

  const response = await queryClient.fetchQuery({ ...currentUserQueryOptions, staleTime: 0 });
  const user = response?.data;

  useCurrentUserStore.getState().setCurrentUser(user);
  useAuthStore.getState().setLoggedIn(Boolean(user));
}
