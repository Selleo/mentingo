import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

interface SettingsNavigationTabsProps {
  onCancel?: () => void;
  onSave?: () => void;
  children?: React.ReactNode;
  accountContent?: React.ReactNode;
  organizationContent?: React.ReactNode;
}

export function SettingsNavigationTabs({
  onCancel,
  onSave,
  accountContent,
  organizationContent,
}: SettingsNavigationTabsProps) {
  const { t } = useTranslation();

  const tabs = [
    { value: "account", label: t("settings.tabs.account") },
    { value: "organization", label: t("settings.tabs.organization") },
  ];

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="rounded px-2 py-1 text-2xl font-bold">{t("settings.title")}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t("settings.buttons.cancel")}
            </Button>
            <Button onClick={onSave}>{t("settings.buttons.save")}</Button>
          </div>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

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
