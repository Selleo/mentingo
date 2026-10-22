import { PERMISSIONS } from "@repo/shared";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetenciesConfiguration } from "~/api/queries/useCompetenciesConfiguration";
import { useCompetenciesWorkspace } from "~/api/queries/useCompetenciesWorkspace";
import { useCompetencyRecords } from "~/api/queries/useCompetencyRecords";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COMPETENCIES_HANDLES } from "../../../e2e/data/competencies/handles";

import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "./CompetenciesStates";
import { CompetenciesCatalog, CompetenciesCatalogEditor } from "./components/CompetenciesCatalog";
import { CompetenciesDocuments } from "./components/CompetenciesDocuments";
import { CompetenciesPeople } from "./components/CompetenciesPeople";
import { CompetenciesActionEditor, CompetenciesPlans } from "./components/CompetenciesPlans";
import { CompetenciesProfiles, CompetenciesProfileEditor } from "./components/CompetenciesProfiles";
import { CompetenciesReview } from "./components/CompetenciesReview";
import { CompetenciesSelect } from "./components/CompetenciesSelect";
import { CompetenciesSettings } from "./components/CompetenciesSettings";
import { CompetenciesTeam } from "./components/CompetenciesTeam";
import { CompetenciesTeamOverview } from "./components/CompetenciesTeamOverview";
import { CompetencySubject } from "./components/CompetencySubject";

import type { Competency, CompetencyProfile } from "./competencies.types";

type Capabilities = { canManage: boolean; canPlan: boolean };
export type WorkspaceTab =
  | "own"
  | "documents"
  | "people"
  | "team"
  | "matrix"
  | "review"
  | "plans"
  | "catalog"
  | "profiles"
  | "settings";
type WorkspaceQuery = NonNullable<Parameters<typeof useCompetenciesWorkspace>[0]>;
const tabClassName =
  "rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none";

export function hasCompetenciesVerifierAccess({
  verifiers,
  userId,
}: {
  verifiers: Record<string, string[]>;
  userId: string;
}) {
  return Object.values(verifiers).some((ids) => ids.includes(userId));
}

export function buildCompetenciesWorkspaceQuery({
  language,
  capabilities,
  tab,
  subjectId,
  profileId,
  matrixProfileId,
}: {
  language: WorkspaceQuery["language"];
  capabilities: Capabilities;
  tab: WorkspaceTab;
  subjectId: string;
  profileId: string;
  matrixProfileId: string;
}): WorkspaceQuery {
  const teamPlans = tab === "plans" && capabilities.canPlan;
  const teamOnly =
    ["team", "matrix"].includes(tab) || (tab === "people" && !capabilities.canManage) || teamPlans;
  return {
    language,
    ...(profileId && tab === "own" ? { profileId } : {}),
    ...(matrixProfileId && tab === "matrix" ? { profileId: matrixProfileId } : {}),
    ...((["own", "documents"].includes(tab) || (tab === "plans" && !teamPlans)) && subjectId
      ? { subjectId }
      : {}),
    ...(teamOnly ? { teamOnly: "true" as const } : {}),
    ...(["people", "team", "matrix", "catalog", "profiles", "settings"].includes(tab)
      ? { view: "summary" as const }
      : {}),
    ...(teamPlans ? { view: "plans" as const } : {}),
    ...(tab === "documents" ? { view: "documents" as const } : {}),
    ...(tab === "review" ? { view: "review" as const } : {}),
  };
}

function Workspace({ capabilities }: { capabilities: Capabilities }) {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const language = useLanguageStore((state) => state.language);
  const [tab, setTab] = useState<WorkspaceTab>(() => {
    if (capabilities.canManage) return "catalog";
    if (capabilities.canPlan) return "people";
    return "own";
  });
  const [subject, setSubject] = useState("");
  const [profileId, setProfileId] = useState("");
  const [teamProfileId, setTeamProfileId] = useState("");
  const [matrixProfileId, setMatrixProfileId] = useState("");
  const [planSubjectId, setPlanSubjectId] = useState<string | null>(null);
  const [catalogEditor, setCatalogEditor] = useState<{ value?: Competency } | null>(null);
  const [profileEditor, setProfileEditor] = useState<{ profile?: CompetencyProfile } | null>(null);
  const [actionsPage, setActionsPage] = useState(1);
  const subjectId = subject || user?.id || "";
  const teamPlans = tab === "plans" && capabilities.canPlan;
  const query = buildCompetenciesWorkspaceQuery({
    language,
    capabilities,
    tab,
    subjectId,
    profileId,
    matrixProfileId,
  });
  const { data, isPending, isError, isPlaceholderData, refetch } = useCompetenciesWorkspace(query);
  const actions = useCompetencyRecords(
    { kind: "actions", page: String(actionsPage), pageSize: "10" },
    teamPlans,
  );
  useEffect(() => {
    if (
      teamPlans &&
      actions.data &&
      !actions.isPlaceholderData &&
      actionsPage > Math.max(1, Math.ceil(actions.data.total / 10))
    )
      setActionsPage(Math.max(1, Math.ceil(actions.data.total / 10)));
  }, [actions.data, actions.isPlaceholderData, actionsPage, teamPlans]);
  useEffect(() => {
    if (
      profileId &&
      (isError || (data && !data.publishedProfiles.some((item) => item.id === profileId)))
    )
      setProfileId("");
  }, [data, isError, profileId]);
  const matrixProfiles = useMemo(
    () =>
      data?.publishedProfiles.filter((profile) =>
        data.subjects.some(
          (subject) =>
            subject.profileId === profile.id &&
            data.people.some((person) => person.id === subject.id && person.canPlan),
        ),
      ) ?? [],
    [data],
  );
  useEffect(() => {
    if (teamProfileId && data && !data.publishedProfiles.some((item) => item.id === teamProfileId))
      setTeamProfileId("");
  }, [data, teamProfileId]);
  useEffect(() => {
    if (
      tab === "matrix" &&
      data &&
      !matrixProfiles.some((profile) => profile.id === matrixProfileId)
    )
      setMatrixProfileId(matrixProfiles[0]?.id ?? "");
  }, [tab, data, matrixProfiles, matrixProfileId]);
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
  if (isError || !data || !user)
    return (
      <PageWrapper breadcrumbs={stateBreadcrumbs}>
        <CompetenciesError
          title={t("competencies.serviceError")}
          actionLabel={t("competencies.retry")}
          onRetry={() => void refetch()}
        />
      </PageWrapper>
    );
  const verifier = hasCompetenciesVerifierAccess({ verifiers: data.verifiers, userId: user.id });
  const canSelectPerson = capabilities.canPlan || verifier;
  const descriptionView = tab === "plans" && !canSelectPerson ? "myPlan" : tab;
  const canEnroll = hasPermission(user.permissions, PERMISSIONS.COURSE_ENROLLMENT);
  const selectedAssessment = data.assessments.find((item) => item.subjectId === subjectId);
  const selectedProfile = data.publishedProfiles.find(
    (item) => item.id === selectedAssessment?.profileId,
  );
  const pageTitle =
    {
      own: subjectId === user.id ? "competencies.own" : "competencies.title",
      documents: "competencies.documents",
      team: "competencies.team",
      matrix: "competencies.matrixTitle",
      plans: canSelectPerson ? "competencies.plans" : "competencies.myPlan",
      people: "competencies.people",
      review: "competencies.review",
      catalog: "competencies.catalogTitle",
      profiles: "competencies.profiles",
      settings: "competencies.settings",
    }[tab] ?? "competencies.title";
  let pageDescription = t(`competencies.descriptionByView.${descriptionView}`, {
    profile: selectedProfile?.name,
  });
  if (tab === "own" && !selectedProfile) pageDescription = t("competencies.noProfile");
  if (tab === "documents") pageDescription = t("competencies.documentsDescription");
  let sectionTitle = "competencies.own";
  if (capabilities.canPlan) sectionTitle = "competencies.people";
  if (capabilities.canManage) sectionTitle = "competencies.title";
  const openReview = (id?: string) => {
    if (verifier) {
      setTab("review");
    } else if (id) {
      setSubject(id);
      setTab("own");
    } else {
      setTab("matrix");
    }
  };
  return (
    <PageWrapper
      breadcrumbs={[
        { title: "Mentingo", href: "/dashboard" },
        {
          title: t(sectionTitle),
          href: "/competencies",
        },
        { title: t(pageTitle), href: "/competencies" },
      ]}
    >
      <div className="flex min-w-0 flex-col gap-6" data-testid={COMPETENCIES_HANDLES.PAGE}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="h3 leading-tight text-primary-950">{t(pageTitle)}</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-neutral-800">{pageDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {capabilities.canManage && tab === "catalog" && (
              <Button onClick={() => setCatalogEditor({})}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {t("competencies.newCompetency")}
              </Button>
            )}
            {tab === "plans" && capabilities.canPlan && (
              <Button onClick={() => setPlanSubjectId("")}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {t("competencies.createPlan")}
              </Button>
            )}
            {capabilities.canManage && tab === "profiles" && (
              <Button onClick={() => setProfileEditor({})}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {t("competencies.newProfile")}
              </Button>
            )}
          </div>
        </div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as WorkspaceTab)}>
          <div className="mb-6 overflow-x-auto border-b border-neutral-200">
            <TabsList
              aria-label={t("competencies.title")}
              className="h-auto min-w-max justify-start gap-1 rounded-none bg-transparent p-0"
            >
              {capabilities.canManage && (
                <>
                  <TabsTrigger
                    className={tabClassName}
                    value="catalog"
                    data-testid={COMPETENCIES_HANDLES.CATALOG}
                  >
                    {t("competencies.catalog")}
                  </TabsTrigger>
                  <TabsTrigger
                    className={tabClassName}
                    value="profiles"
                    data-testid={COMPETENCIES_HANDLES.PROFILES}
                  >
                    {t("competencies.profiles")}
                  </TabsTrigger>
                </>
              )}
              {!capabilities.canManage && (!capabilities.canPlan || tab === "own") && (
                <TabsTrigger
                  className={tabClassName}
                  value="own"
                  data-testid={COMPETENCIES_HANDLES.OWN}
                >
                  {t(canSelectPerson ? "competencies.title" : "competencies.own")}
                </TabsTrigger>
              )}
              {capabilities.canPlan && (
                <TabsTrigger
                  className={tabClassName}
                  value="people"
                  data-testid={COMPETENCIES_HANDLES.PEOPLE}
                >
                  {t("competencies.people")}
                </TabsTrigger>
              )}
              <TabsTrigger
                className={tabClassName}
                value="documents"
                data-testid={COMPETENCIES_HANDLES.DOCUMENTS}
              >
                {t("competencies.documents")}
              </TabsTrigger>
              {capabilities.canPlan && (
                <TabsTrigger
                  className={tabClassName}
                  value="team"
                  data-testid={COMPETENCIES_HANDLES.TEAM}
                >
                  {t("competencies.team")}
                </TabsTrigger>
              )}
              {capabilities.canPlan && (
                <TabsTrigger
                  className={tabClassName}
                  value="matrix"
                  data-testid={COMPETENCIES_HANDLES.MATRIX}
                >
                  {t("competencies.matrix")}
                </TabsTrigger>
              )}
              {verifier && (
                <TabsTrigger
                  className={tabClassName}
                  value="review"
                  data-testid={COMPETENCIES_HANDLES.REVIEW}
                >
                  {t("competencies.review")}
                </TabsTrigger>
              )}
              <TabsTrigger
                className={tabClassName}
                value="plans"
                data-testid={COMPETENCIES_HANDLES.PLANS}
              >
                {t(canSelectPerson ? "competencies.plans" : "competencies.myPlan")}
              </TabsTrigger>
              {capabilities.canManage && (
                <>
                  <TabsTrigger
                    className={tabClassName}
                    value="settings"
                    data-testid={COMPETENCIES_HANDLES.SETTINGS}
                  >
                    {t("competencies.settings")}
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>
          {(tab === "team" || (["own", "documents"].includes(tab) && canSelectPerson)) && (
            <div className="mb-5 flex flex-wrap items-end gap-3 [&>div]:w-full [&>div]:sm:w-64">
              {canSelectPerson && ["own", "documents"].includes(tab) && (
                <CompetenciesSelect
                  label={t("competencies.person")}
                  value={subjectId}
                  options={data.people
                    .filter((person) => !person.archived)
                    .map((person) => ({ value: person.id, label: person.name }))}
                  onChange={setSubject}
                />
              )}
              {tab !== "documents" && (
                <CompetenciesSelect
                  label={t("competencies.compareProfile")}
                  hideLabel={tab === "team"}
                  value={tab === "team" ? teamProfileId : profileId}
                  emptyLabel={t("competencies.assignedProfile")}
                  options={data.publishedProfiles.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  onChange={tab === "team" ? setTeamProfileId : setProfileId}
                />
              )}
              {tab === "team" && (
                <span className="flex h-[42px] items-center rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800">
                  {t("competencies.peopleCount", {
                    count: data.assessments.filter(
                      (item) =>
                        (!teamProfileId ||
                          data.subjects.some(
                            (subject) =>
                              subject.id === item.subjectId && subject.profileId === teamProfileId,
                          )) &&
                        data.people.some(
                          (person) => person.id === item.subjectId && person.canPlan,
                        ),
                    ).length,
                  })}
                </span>
              )}
            </div>
          )}
          {isPlaceholderData ? (
            <CompetenciesLoading label={t("competencies.loading")} />
          ) : (
            <>
              <TabsContent value="own">
                <CompetencySubject
                  workspace={data}
                  subjectId={canSelectPerson ? subjectId : user.id}
                  userId={user.id}
                  canManage={capabilities.canManage}
                  onPlan={() => setTab("plans")}
                />
              </TabsContent>
              <TabsContent value="documents">
                <CompetenciesDocuments
                  key={subjectId}
                  workspace={data}
                  subjectId={canSelectPerson ? subjectId : user.id}
                  userId={user.id}
                />
              </TabsContent>
              {capabilities.canPlan && (
                <TabsContent value="people">
                  <CompetenciesPeople
                    workspace={data}
                    canManage={capabilities.canManage}
                    onSubject={(id) => {
                      setSubject(id);
                      setTab("own");
                    }}
                  />
                </TabsContent>
              )}
              {capabilities.canPlan && (
                <TabsContent value="matrix">
                  <CompetenciesTeam
                    workspace={data}
                    profiles={matrixProfiles}
                    profileId={matrixProfileId}
                    onProfileChange={setMatrixProfileId}
                    onSubject={(id) => {
                      setSubject(id);
                      setTab("own");
                    }}
                  />
                </TabsContent>
              )}
              {capabilities.canPlan && (
                <TabsContent value="team">
                  <CompetenciesTeamOverview
                    profileId={teamProfileId}
                    workspace={data}
                    onMatrix={() => {
                      setMatrixProfileId(teamProfileId);
                      setTab("matrix");
                    }}
                    onPlans={() => {
                      setSubject("");
                      setTab("plans");
                    }}
                    onReview={openReview}
                    onPlan={(id) => {
                      setPlanSubjectId(id);
                      setTab("plans");
                    }}
                    onSubject={(id) => {
                      setSubject(id);
                      setTab("own");
                    }}
                  />
                </TabsContent>
              )}
              {verifier && (
                <TabsContent value="review">
                  <CompetenciesReview
                    workspace={data}
                    userId={user.id}
                    onSubject={(id) => {
                      setSubject(id);
                      setTab("own");
                    }}
                  />
                </TabsContent>
              )}
              <TabsContent value="plans">
                {teamPlans && actions.isPending && (
                  <CompetenciesLoading label={t("competencies.loading")} />
                )}
                {teamPlans && actions.isError && (
                  <CompetenciesError
                    title={t("competencies.serviceError")}
                    actionLabel={t("competencies.retry")}
                    onRetry={() => void actions.refetch()}
                  />
                )}
                {(!teamPlans || (!actions.isPending && !actions.isError)) && (
                  <CompetenciesPlans
                    workspace={{
                      ...data,
                      people: [
                        ...data.people,
                        ...(actions.data?.people ?? []).filter(
                          (person) => !data.people.some((item) => item.id === person.id),
                        ),
                      ],
                    }}
                    subjectId={teamPlans ? "" : subjectId}
                    userId={user.id}
                    canPlan={
                      teamPlans ||
                      data.people.some((person) => person.id === subjectId && person.canPlan)
                    }
                    canEnroll={canEnroll}
                    pagination={
                      teamPlans
                        ? {
                            page: actionsPage,
                            total: actions.data?.total ?? 0,
                            actions: actions.data?.actions ?? [],
                            onPageChange: setActionsPage,
                            loading: actions.isPlaceholderData,
                          }
                        : undefined
                    }
                    onDocuments={(id) => {
                      setSubject(id);
                      setTab("documents");
                    }}
                  />
                )}
              </TabsContent>
              {capabilities.canManage && (
                <>
                  <TabsContent value="catalog">
                    <CompetenciesCatalog
                      workspace={data}
                      onEdit={(value) => setCatalogEditor({ value })}
                    />
                  </TabsContent>
                  <TabsContent value="profiles">
                    <CompetenciesProfiles
                      workspace={data}
                      onEdit={(profile) => setProfileEditor({ profile })}
                    />
                  </TabsContent>
                  <TabsContent value="settings">
                    <CompetenciesSettings workspace={data} />
                  </TabsContent>
                </>
              )}
            </>
          )}
        </Tabs>
        {tab === "profiles" && capabilities.canManage && profileEditor && (
          <CompetenciesProfileEditor
            workspace={data}
            profile={profileEditor.profile}
            close={() => setProfileEditor(null)}
          />
        )}
        {tab === "catalog" && capabilities.canManage && catalogEditor && (
          <CompetenciesCatalogEditor
            workspace={data}
            value={catalogEditor.value}
            onClose={() => setCatalogEditor(null)}
          />
        )}
        {tab === "plans" && capabilities.canPlan && planSubjectId !== null && (
          <CompetenciesActionEditor
            workspace={data}
            subjectId={planSubjectId}
            userId={user.id}
            close={() => setPlanSubjectId(null)}
          />
        )}
      </div>
    </PageWrapper>
  );
}
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
          <h1 className="h3 leading-tight text-primary-950">{t("competencies.title")}</h1>
          <CompetenciesEmpty message={t("competencies.unavailable")} />
        </div>
      </PageWrapper>
    );
  return <Workspace capabilities={configuration.data} />;
}
