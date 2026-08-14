import { useSearchParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";
import { SETTINGS_TAB_QUERY_PARAM, SETTINGS_TABS } from "../constants";

import type React from "react";

interface SettingsNavigationTabsProps {
  canManageSettings: boolean;
  isSupportMode?: boolean;
  hideAccountTab?: boolean;
  children?: React.ReactNode;
  accountContent?: React.ReactNode;
  integrationsContent?: React.ReactNode;
  organizationContent?: React.ReactNode;
  customizePlatformContent?: React.ReactNode;
  hasConfigurationIssues?: boolean;
}

export function SettingsNavigationTabs({
  canManageSettings,
  isSupportMode = false,
  hideAccountTab = false,
  accountContent,
  integrationsContent,
  organizationContent,
  customizePlatformContent,
  hasConfigurationIssues,
}: SettingsNavigationTabsProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const adminTabs = [
    { value: SETTINGS_TABS.ORGANIZATION, label: t("settings.tabs.organization") },
    {
      value: SETTINGS_TABS.PLATFORM_CUSTOMIZATION,
      label: t("settings.tabs.platformCustomization"),
    },
  ];

  const allTabs = [
    ...(!hideAccountTab
      ? [{ value: SETTINGS_TABS.ACCOUNT, label: t("settings.tabs.account") }]
      : []),
    ...(!hideAccountTab
      ? [{ value: SETTINGS_TABS.INTEGRATIONS, label: t("settings.tabs.integrations") }]
      : []),
    ...(canManageSettings ? adminTabs : []),
  ];

  if (isSupportMode && allTabs.length === 0) {
    return (
      <Card id="settings-tabs" className="w-full">
        <CardContent className="p-6">
          <div className="space-y-2">
            <h4 className="h4">{t("settings.title")}</h4>
            <p
              className="text-sm text-muted-foreground"
              data-testid={SETTINGS_PAGE_HANDLES.NO_AVAILABLE_SETTINGS}
            >
              {t("settings.supportModeNoAvailable")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultTab =
    hideAccountTab && canManageSettings ? SETTINGS_TABS.ORGANIZATION : SETTINGS_TABS.ACCOUNT;
  const requestedTab = searchParams.get(SETTINGS_TAB_QUERY_PARAM);
  const activeTab = allTabs.some((tab) => tab.value === requestedTab) ? requestedTab! : defaultTab;

  const handleTabChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(SETTINGS_TAB_QUERY_PARAM, value);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="w-full bg-transparent flex flex-col gap-y-4"
    >
      <Card id="settings-tabs" className="w-full">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="h4">{t("settings.title")}</h4>
          </div>
          <div className="flex justify-start">
            <TabsList className="inline-flex h-auto items-center justify-center rounded-md bg-primary-50 text-muted-foreground">
              {allTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  data-testid={match(tab.value)
                    .with(SETTINGS_TABS.ACCOUNT, () => SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)
                    .with(SETTINGS_TABS.INTEGRATIONS, () => SETTINGS_PAGE_HANDLES.INTEGRATIONS_TAB)
                    .with(SETTINGS_TABS.ORGANIZATION, () => SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)
                    .otherwise(() => SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium text-neutral-900 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm relative"
                >
                  {tab.label}
                  {hasConfigurationIssues && tab.value === SETTINGS_TABS.ORGANIZATION && (
                    <span
                      className="absolute top-1 right-1 size-2 rounded-full bg-error-500"
                      data-testid={SETTINGS_PAGE_HANDLES.ORGANIZATION_WARNING_INDICATOR}
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {!hideAccountTab && (
            <TabsContent
              value={SETTINGS_TABS.ACCOUNT}
              className="space-y-6"
              data-testid={SETTINGS_PAGE_HANDLES.ACCOUNT_CONTENT}
            >
              {accountContent}
            </TabsContent>
          )}

          <TabsContent
            value={SETTINGS_TABS.INTEGRATIONS}
            className="space-y-6"
            data-testid={SETTINGS_PAGE_HANDLES.INTEGRATIONS_CONTENT}
          >
            {integrationsContent}
          </TabsContent>

          <TabsContent
            value={SETTINGS_TABS.ORGANIZATION}
            className="space-y-6"
            data-testid={SETTINGS_PAGE_HANDLES.ORGANIZATION_CONTENT}
          >
            {organizationContent}
          </TabsContent>

          <TabsContent
            value={SETTINGS_TABS.PLATFORM_CUSTOMIZATION}
            className="space-y-6"
            data-testid={SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_CONTENT}
          >
            {customizePlatformContent}
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}
