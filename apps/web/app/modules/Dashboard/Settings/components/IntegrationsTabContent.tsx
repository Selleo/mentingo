import { IntegrationApiKeyCard } from "./IntegrationApiKeyCard";
import { MicrosoftCalendarCard } from "./MicrosoftCalendarCard";

interface IntegrationsTabContentProps {
  canAccessIntegrationApi: boolean;
}

export function IntegrationsTabContent({ canAccessIntegrationApi }: IntegrationsTabContentProps) {
  return (
    <>
      <MicrosoftCalendarCard />
      {canAccessIntegrationApi && <IntegrationApiKeyCard />}
    </>
  );
}
