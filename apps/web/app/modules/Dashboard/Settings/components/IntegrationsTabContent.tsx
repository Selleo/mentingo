import { IntegrationApiKeysCard } from "./IntegrationApiKeysCard";
import { MicrosoftCalendarCard } from "./MicrosoftCalendarCard";

interface IntegrationsTabContentProps {
  canAccessIntegrationApi: boolean;
}

export function IntegrationsTabContent({ canAccessIntegrationApi }: IntegrationsTabContentProps) {
  return (
    <>
      <MicrosoftCalendarCard />
      {canAccessIntegrationApi && <IntegrationApiKeysCard />}
    </>
  );
}
