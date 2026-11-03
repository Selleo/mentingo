import { useTranslation } from "react-i18next";

import { useCompetenciesConfiguration } from "~/api/queries/useCompetenciesConfiguration";
import { PageWrapper } from "~/components/PageWrapper";

import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "./CompetenciesStates";
import { CompetenciesWorkspace } from "./components/CompetenciesWorkspace";

export default function CompetenciesPage() {
  const { t } = useTranslation();
  const configuration = useCompetenciesConfiguration();
  const breadcrumbs = [
    { title: "Mentingo", href: "/dashboard" },
    { title: t("competencies.title"), href: "/competencies" },
  ];
  if (configuration.isPending)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <CompetenciesLoading label={t("competencies.loading")} />
      </PageWrapper>
    );
  if (configuration.isError)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <CompetenciesError
          title={t("competencies.serviceError")}
          actionLabel={t("competencies.retry")}
          onRetry={() => void configuration.refetch()}
        />
      </PageWrapper>
    );
  if (!configuration.data?.enabled)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <div className="flex flex-col gap-4">
          <h1 className="h4 leading-tight text-neutral-950">{t("competencies.title")}</h1>
          <CompetenciesEmpty message={t("competencies.unavailable")} />
        </div>
      </PageWrapper>
    );
  return <CompetenciesWorkspace capabilities={configuration.data} />;
}

export { CompetenciesPerson } from "./components/CompetenciesPerson";

export { CompetenciesWorkspace } from "./components/CompetenciesWorkspace";

export {
  WORKSPACE_SEARCH_PARAMS,
  WORKSPACE_TABS,
  getDefaultWorkspaceTab,
  parseWorkspaceTab,
  tabClassName,
  type Capabilities,
  type WorkspaceSearchParam,
  type WorkspaceTab,
} from "./utils/competenciesWorkspace.utils";
