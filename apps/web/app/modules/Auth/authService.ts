import { ApiClient } from "~/api/api-client";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { useAuthStore } from "./authStore";

export const authService = {
  logout() {
    useAuthStore.setState({ isLoggedIn: false });
    useCurrentUserStore.setState({ currentUser: undefined });
  },

  /**
   * Clears the auth cookies on the server and the local session state. The local state is
   * cleared even when the server call fails, so a stale session never blocks the UI.
   */
  async logoutFromServer() {
    try {
      await ApiClient.api.authControllerLogout();
    } catch {
      // The local logout below is enough to show the user as logged out.
    } finally {
      authService.logout();
    }
  },

  async refreshToken() {
    return ApiClient.api.authControllerRefreshTokens();
  },
};
