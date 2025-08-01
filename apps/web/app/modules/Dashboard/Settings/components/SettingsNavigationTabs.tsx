import { useTranslation } from "react-i18next";

import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

interface SettingsNavigationTabsProps {
  isAdmin: boolean;
  children?: React.ReactNode;
  accountContent?: React.ReactNode;
  organizationContent?: React.ReactNode;
}

export function SettingsNavigationTabs({
  isAdmin,
  accountContent,
  organizationContent,
}: SettingsNavigationTabsProps) {
  const { t } = useTranslation();

  const adminTabs = [{ value: "organization", label: t("settings.tabs.organization") }];

  const allTabs = [
    { value: "account", label: t("settings.tabs.account") },
    ...(isAdmin ? adminTabs : []),
  ];

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="rounded px-2 py-1 text-2xl font-bold">{t("settings.title")}</h1>
        </div>
        <Tabs defaultValue="account" className="w-full">
          <div className="mb-6 flex justify-start">
            <TabsList className="inline-flex h-auto items-center justify-center rounded-md bg-primary-50 p-1 text-muted-foreground">
              {allTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium text-neutral-900 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="account" className="mt-6 space-y-6">
            {accountContent}
          </TabsContent>

          <TabsContent value="organization" className="mt-6 space-y-6">
            {organizationContent}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
