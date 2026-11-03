import { PageWrapper } from "~/components/PageWrapper";
import { Tabs, TabsContent } from "~/components/ui/tabs";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { useCompetenciesWorkspace } from "../hooks/useCompetenciesWorkspace";
import {
  WORKSPACE_SEARCH_PARAMS,
  WORKSPACE_TABS,
  getWorkspacePresentation,
} from "../utils/competenciesWorkspace.utils";

import { CompetenciesCatalogEditor } from "./CompetenciesCatalog";
import { CompetenciesOverview } from "./CompetenciesOverview";
import { CompetenciesPerson } from "./CompetenciesPerson";
import { CompetenciesProfileEditor } from "./CompetenciesProfiles";
import { CompetenciesReview } from "./CompetenciesReview";
import { CompetenciesSetup } from "./CompetenciesSetup";
import { CompetenciesWorkspaceTabs } from "./CompetenciesWorkspaceTabs";
import { CompetencyCategoryEditor } from "./CompetencyCategoryEditor";

import type { CompetenciesWorkspaceOptions } from "../hooks/competencies-hooks.types";
import type { WorkspaceTab } from "../utils/competenciesWorkspace.utils";

export type CompetenciesWorkspaceProps = CompetenciesWorkspaceOptions;

export function CompetenciesWorkspace({ capabilities }: CompetenciesWorkspaceProps) {
  const {
    t,
    user,
    tab,
    personId,
    setupSection,
    categoryEditorOpen,
    setCategoryEditorOpen,
    catalogEditor,
    setCatalogEditor,
    profileEditor,
    setProfileEditor,
    summary,
    isPending,
    isError,
    refetch,
    canSeeTeam,
    updateSearchParams,
    openTab,
    openPerson,
    closePerson,
    startSetupStep,
  } = useCompetenciesWorkspace({ capabilities });
  const stateBreadcrumbs = [
    { title: "Mentingo", href: "/dashboard" },
    { title: t("competencies.title"), href: "/competencies" },
  ];
  if (isPending)
    return (
      <PageWrapper breadcrumbs={stateBreadcrumbs}>
        <CompetenciesLoading label={t("competencies.loading")} />
      </PageWrapper>
    );
  if (isError || !summary || !user)
    return (
      <PageWrapper breadcrumbs={stateBreadcrumbs}>
        <CompetenciesError
          title={t("competencies.serviceError")}
          actionLabel={t("competencies.retry")}
          onRetry={() => void refetch()}
        />
      </PageWrapper>
    );

  const { tabs, activeTabLabel, pageDescription } = getWorkspacePresentation(
    capabilities,
    summary,
    tab,
    t,
  );

  return (
    <PageWrapper
      breadcrumbs={[...stateBreadcrumbs, { title: activeTabLabel, href: "/competencies" }]}
    >
      <div className="flex min-w-0 flex-col gap-6" data-testid={COMPETENCIES_HANDLES.PAGE}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="h4 leading-tight text-neutral-950">{t("competencies.title")}</h1>
            <p className="body-sm max-w-3xl text-neutral-800">{pageDescription}</p>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(value) => openTab(value as WorkspaceTab)}>
          <CompetenciesWorkspaceTabs tabs={tabs} />
          {personId && (
            <CompetenciesPerson
              key={personId}
              subjectId={personId}
              userId={user.id}
              canManage={capabilities.canManage}
              canCompare={canSeeTeam}
              backLabel={t("competencies.backTo", { tab: activeTabLabel })}
              onBack={closePerson}
            />
          )}
          {!personId && (
            <>
              <TabsContent value={WORKSPACE_TABS.OVERVIEW}>
                <CompetenciesOverview
                  summary={summary}
                  canManage={capabilities.canManage}
                  onPersonOpen={openPerson}
                  onSetupStepStart={startSetupStep}
                />
              </TabsContent>
              <TabsContent value={WORKSPACE_TABS.OWN}>
                <CompetenciesPerson
                  subjectId={user.id}
                  userId={user.id}
                  canManage={capabilities.canManage}
                  canCompare={false}
                />
              </TabsContent>
              {summary.isVerifier && (
                <TabsContent value={WORKSPACE_TABS.REVIEW}>
                  <CompetenciesReview onSubject={openPerson} />
                </TabsContent>
              )}
              {capabilities.canManage && (
                <TabsContent value={WORKSPACE_TABS.SETUP}>
                  <CompetenciesSetup
                    summary={summary}
                    section={setupSection}
                    onSectionChange={(section) =>
                      updateSearchParams({ [WORKSPACE_SEARCH_PARAMS.SECTION]: section })
                    }
                    onCompetencyEdit={(value) => setCatalogEditor({ value })}
                    onProfileEdit={(profile) => setProfileEditor({ profile })}
                  />
                </TabsContent>
              )}
            </>
          )}
        </Tabs>
        {capabilities.canManage && categoryEditorOpen && (
          <CompetencyCategoryEditor onClose={() => setCategoryEditorOpen(false)} />
        )}
        {capabilities.canManage && profileEditor && (
          <CompetenciesProfileEditor
            profile={profileEditor.profile}
            close={() => setProfileEditor(null)}
          />
        )}
        {capabilities.canManage && catalogEditor && (
          <CompetenciesCatalogEditor
            value={catalogEditor.value}
            onClose={() => setCatalogEditor(null)}
          />
        )}
      </div>
    </PageWrapper>
  );
}
