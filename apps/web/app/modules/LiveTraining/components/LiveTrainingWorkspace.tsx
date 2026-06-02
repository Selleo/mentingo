import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { LiveTrainingMaterials } from "~/modules/LiveTraining/components/LiveTrainingMaterials";
import { LiveTrainingOverview } from "~/modules/LiveTraining/components/LiveTrainingOverview";
import { LiveTrainingSessionsPanel } from "~/modules/LiveTraining/components/LiveTrainingSessionsPanel";
import { LIVE_TRAINING_WORKSPACE_TABS } from "~/modules/LiveTraining/liveTraining.types";

import { LIVE_TRAINING_HANDLES } from "../../../../e2e/data/live-training/handles";

import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingWorkspaceProps = {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
};

export function LiveTrainingWorkspace({ liveTraining, actions }: LiveTrainingWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <Tabs
      defaultValue={LIVE_TRAINING_WORKSPACE_TABS.OVERVIEW}
      className="grid gap-4"
      data-testid={LIVE_TRAINING_HANDLES.WORKSPACE}
    >
      <TabsList className="h-auto w-fit bg-neutral-100 p-1">
        <TabsTrigger
          value={LIVE_TRAINING_WORKSPACE_TABS.OVERVIEW}
          data-testid={LIVE_TRAINING_HANDLES.OVERVIEW_TAB}
        >
          {t("liveTrainingView.tabs.overview")}
        </TabsTrigger>
        <TabsTrigger
          value={LIVE_TRAINING_WORKSPACE_TABS.FILES}
          data-testid={LIVE_TRAINING_HANDLES.FILES_TAB}
        >
          {t("liveTrainingView.tabs.files")}
        </TabsTrigger>
        {actions.canViewSessionData && (
          <TabsTrigger
            value={LIVE_TRAINING_WORKSPACE_TABS.SESSIONS}
            data-testid={LIVE_TRAINING_HANDLES.SESSIONS_TAB}
          >
            {t("liveTrainingView.tabs.sessions")}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value={LIVE_TRAINING_WORKSPACE_TABS.OVERVIEW}>
        <LiveTrainingOverview
          liveTraining={liveTraining}
          canEditPeople={actions.canManagePeople}
          className="lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)]"
        />
      </TabsContent>

      <TabsContent value={LIVE_TRAINING_WORKSPACE_TABS.FILES}>
        <LiveTrainingMaterials liveTraining={liveTraining} actions={actions} />
      </TabsContent>

      {actions.canViewSessionData && (
        <TabsContent value={LIVE_TRAINING_WORKSPACE_TABS.SESSIONS}>
          <LiveTrainingSessionsPanel liveTrainingId={liveTraining.id} />
        </TabsContent>
      )}
    </Tabs>
  );
}
