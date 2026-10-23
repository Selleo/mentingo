import { useSearchParams } from "@remix-run/react";
import { Building2, Palette, Plug, UserRound } from "lucide-react";
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
  hasIntegrationsAvailable?: boolean;
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
  hasIntegrationsAvailable = true,
}: SettingsNavigationTabsProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const adminTabs = [
    { value: SETTINGS_TABS.ORGANIZATION, label: t("settings.tabs.organization"), icon: Building2 },
    {
      value: SETTINGS_TABS.PLATFORM_CUSTOMIZATION,
      label: t("settings.tabs.platformCustomization"),
      icon: Palette,
    },
  ];

  const allTabs = [
    ...(!hideAccountTab
      ? [{ value: SETTINGS_TABS.ACCOUNT, label: t("settings.tabs.account"), icon: UserRound }]
      : []),
    ...(!hideAccountTab && hasIntegrationsAvailable
      ? [{ value: SETTINGS_TABS.INTEGRATIONS, label: t("settings.tabs.integrations"), icon: Plug }]
      : []),
    ...(canManageSettings ? adminTabs : []),
  ];

  const header = <h4 className="h4 text-neutral-950">{t("settings.title")}</h4>;

  if (isSupportMode && allTabs.length === 0) {
    return (
      <div className="flex w-full flex-col gap-y-6">
        {header}
        <Card id="settings-tabs" className="w-full">
          <CardContent className="p-6">
            <p
              className="text-sm text-muted-foreground"
              data-testid={SETTINGS_PAGE_HANDLES.NO_AVAILABLE_SETTINGS}
            >
              {t("settings.supportModeNoAvailable")}
            </p>
          </CardContent>
        </Card>
      </div>
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
      className="flex w-full flex-col gap-y-6 bg-transparent"
    >
      {header}

      <div id="settings-tabs" className="overflow-x-auto border-b">
        <TabsList className="h-auto min-w-max justify-start gap-2 rounded-none bg-transparent p-0">
          {allTabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              data-testid={match(value)
                .with(SETTINGS_TABS.ACCOUNT, () => SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)
                .with(SETTINGS_TABS.INTEGRATIONS, () => SETTINGS_PAGE_HANDLES.INTEGRATIONS_TAB)
                .with(SETTINGS_TABS.ORGANIZATION, () => SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)
                .otherwise(() => SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB)}
              className="relative gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
              {hasConfigurationIssues && value === SETTINGS_TABS.ORGANIZATION && (
                <span
                  className="absolute top-2 right-1 size-2 rounded-full bg-error-500"
                  data-testid={SETTINGS_PAGE_HANDLES.ORGANIZATION_WARNING_INDICATOR}
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {!hideAccountTab && (
        <TabsContent
          value={SETTINGS_TABS.ACCOUNT}
          className="m-0 space-y-6"
          data-testid={SETTINGS_PAGE_HANDLES.ACCOUNT_CONTENT}
        >
          {accountContent}
        </TabsContent>
      )}

      {hasIntegrationsAvailable && (
        <TabsContent
          value={SETTINGS_TABS.INTEGRATIONS}
          className="m-0 space-y-6"
          data-testid={SETTINGS_PAGE_HANDLES.INTEGRATIONS_CONTENT}
        >
          {integrationsContent}
        </TabsContent>
      )}

      <TabsContent
        value={SETTINGS_TABS.ORGANIZATION}
        className="m-0 space-y-6"
        data-testid={SETTINGS_PAGE_HANDLES.ORGANIZATION_CONTENT}
      >
        {organizationContent}
      </TabsContent>

      <TabsContent
        value={SETTINGS_TABS.PLATFORM_CUSTOMIZATION}
        className="m-0 space-y-6"
        data-testid={SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_CONTENT}
      >
        {customizePlatformContent}
      </TabsContent>
    </Tabs>
  );
}
