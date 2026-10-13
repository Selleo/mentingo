import { useSearchParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { LayoutTemplate, List, Mail, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { EmailTemplatesContent } from "../EmailTemplates/EmailTemplates.page";

import AutomationLogsContent from "./AutomationLogs.page";
import AutomationsContent from "./Automations.page";
import { AutomationWorkflowTemplates } from "./Workspace/AutomationWorkflowTemplates";
import {
  AUTOMATION_WORKSPACE_PATH,
  AUTOMATION_WORKSPACE_TABS,
} from "./Workspace/workspace.constants";

export default function AutomationsWorkspacePage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = [
    {
      value: AUTOMATION_WORKSPACE_TABS.AUTOMATIONS,
      label: t("automations.title"),
      icon: Workflow,
      permission: PERMISSIONS.AUTOMATION_MANAGE,
      Content: AutomationsContent,
    },
    {
      value: AUTOMATION_WORKSPACE_TABS.AUTOMATION_TEMPLATES,
      label: t("automationWorkspace.templates"),
      icon: LayoutTemplate,
      permission: PERMISSIONS.AUTOMATION_MANAGE,
      Content: AutomationWorkflowTemplates,
    },
    {
      value: AUTOMATION_WORKSPACE_TABS.EMAIL_TEMPLATES,
      label: t("emailTemplates.ui.title"),
      icon: Mail,
      permission: PERMISSIONS.EMAIL_TEMPLATE_MANAGE,
      Content: EmailTemplatesContent,
    },
    {
      value: AUTOMATION_WORKSPACE_TABS.LOGS,
      label: t("automationLogs.title"),
      icon: List,
      permission: PERMISSIONS.AUTOMATION_LOG_READ,
      Content: AutomationLogsContent,
    },
  ].filter((tab) => hasPermission(user?.permissions, tab.permission));
  const selectedTab =
    tabs.find((tab) => tab.value === searchParams.get("tab"))?.value ?? tabs[0]?.value;

  if (!selectedTab) return null;

  return (
    <PageWrapper
      breadcrumbs={[{ title: t("automationWorkspace.title"), href: AUTOMATION_WORKSPACE_PATH }]}
    >
      <Tabs
        value={selectedTab}
        onValueChange={(tab) => setSearchParams({ tab })}
        className="space-y-6"
      >
        <div className="overflow-x-auto border-b">
          <TabsList className="h-auto min-w-max justify-start gap-2 rounded-none bg-transparent p-0">
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map(({ value, Content }) => (
          <TabsContent key={value} value={value} className="m-0">
            <Content />
          </TabsContent>
        ))}
      </Tabs>
    </PageWrapper>
  );
}
