import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { LiveTrainingMaterials } from "~/modules/LiveTraining/components/LiveTrainingMaterials";
import { LiveTrainingOverview } from "~/modules/LiveTraining/components/LiveTrainingOverview";
import { LIVE_TRAINING_WORKSPACE_TABS } from "~/modules/LiveTraining/liveTraining.types";

import type { ReactNode } from "react";
import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingWorkspaceProps = {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
  canManageUsers: boolean;
};

type DeferredPanelProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

function DeferredPanel({ icon, title, description }: DeferredPanelProps) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded bg-neutral-50 text-neutral-500">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">{description}</p>
        </div>
      </div>
    </section>
  );
}

export function LiveTrainingWorkspace({
  liveTraining,
  actions,
  canManageUsers,
}: LiveTrainingWorkspaceProps) {
  const { t } = useTranslation();
  const canEditPeople = actions.canShowEdit && canManageUsers;

  return (
    <Tabs defaultValue={LIVE_TRAINING_WORKSPACE_TABS.OVERVIEW} className="grid gap-4">
      <TabsList className="h-auto w-fit bg-neutral-100 p-1">
        <TabsTrigger value={LIVE_TRAINING_WORKSPACE_TABS.OVERVIEW}>
          {t("liveTrainingView.tabs.overview")}
        </TabsTrigger>
        <TabsTrigger value={LIVE_TRAINING_WORKSPACE_TABS.FILES}>
          {t("liveTrainingView.tabs.files")}
        </TabsTrigger>
        <TabsTrigger value={LIVE_TRAINING_WORKSPACE_TABS.ATTENDANCE}>
          {t("liveTrainingView.tabs.attendance")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value={LIVE_TRAINING_WORKSPACE_TABS.OVERVIEW}>
        <LiveTrainingOverview
          liveTraining={liveTraining}
          canEditPeople={canEditPeople}
          className="lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)]"
        />
      </TabsContent>

      <TabsContent value={LIVE_TRAINING_WORKSPACE_TABS.FILES}>
        <LiveTrainingMaterials liveTraining={liveTraining} />
      </TabsContent>

      <TabsContent value={LIVE_TRAINING_WORKSPACE_TABS.ATTENDANCE}>
        <DeferredPanel
          icon={<Users className="size-4" />}
          title={t("liveTrainingView.attendance.title")}
          description={t("liveTrainingView.attendance.description")}
        />
      </TabsContent>
    </Tabs>
  );
}
