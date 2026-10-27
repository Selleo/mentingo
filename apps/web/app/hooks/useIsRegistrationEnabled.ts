import { useGlobalSettings } from "~/api/queries/useGlobalSettings";

/**
 * Registration is disabled when the tenant is invite-only.
 * Returns false until settings are loaded to avoid flashing sign-up entry points.
 */
export function useIsRegistrationEnabled() {
  const { data: globalSettings } = useGlobalSettings();

  if (!globalSettings) return false;

  return !globalSettings.inviteOnlyRegistration;
}
