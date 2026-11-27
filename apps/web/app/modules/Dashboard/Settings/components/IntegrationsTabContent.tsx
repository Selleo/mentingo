import { GoogleCalendarCard } from "./GoogleCalendarCard";
import { DirectorySyncCard } from "./directory-sync/DirectorySyncCard";
import { IntegrationApiKeysCard } from "./IntegrationApiKeysCard";
import { MicrosoftCalendarCard } from "./MicrosoftCalendarCard";

interface IntegrationsTabContentProps {
  canAccessIntegrationApi: boolean;
  canManageDirectorySync: boolean;
}

export function IntegrationsTabContent({
  canAccessIntegrationApi,
  canManageDirectorySync,
}: IntegrationsTabContentProps) {
  return (
    <>
      <MicrosoftCalendarCard />
      <GoogleCalendarCard />
      {canManageDirectorySync && <DirectorySyncCard />}
      {canAccessIntegrationApi && <IntegrationApiKeysCard />}
    </>
  );
}
