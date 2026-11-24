import { GoogleCalendarCard } from "./GoogleCalendarCard";
import { IntegrationApiKeysCard } from "./IntegrationApiKeysCard";
import { MicrosoftCalendarCard } from "./MicrosoftCalendarCard";

interface IntegrationsTabContentProps {
  canAccessIntegrationApi: boolean;
}

export function IntegrationsTabContent({ canAccessIntegrationApi }: IntegrationsTabContentProps) {
  return (
    <>
      <MicrosoftCalendarCard />
      <GoogleCalendarCard />
      {canAccessIntegrationApi && <IntegrationApiKeysCard />}
    </>
  );
}
