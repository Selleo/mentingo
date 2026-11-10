import { LEADERBOARD_VISIBILITY, type LeaderboardVisibility } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useUpdateLeaderboardSettings } from "~/api/mutations/admin/useUpdateLeaderboardSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import { LEADERBOARD_HANDLES } from "../../../../../../e2e/data/gamification/handles";

import type { GlobalSettings } from "../../types";

type LeaderboardSettingsCardProps = {
  globalSettings: GlobalSettings;
};

const VISIBILITY_OPTIONS = [
  { value: LEADERBOARD_VISIBILITY.CLOSED, key: "closed" },
  { value: LEADERBOARD_VISIBILITY.PUBLIC, key: "public" },
] as const;

export function LeaderboardSettingsCard({ globalSettings }: LeaderboardSettingsCardProps) {
  const { t } = useTranslation();
  const { mutate: updateLeaderboardSettings, isPending } = useUpdateLeaderboardSettings();
  const isVisibilityDisabled = isPending || !globalSettings.leaderboardsEnabled;

  if (!globalSettings.gamificationEnabled) return null;

  return (
    <Card id="leaderboard-settings" data-testid={LEADERBOARD_HANDLES.SETTINGS_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("gamification.leaderboard.settings.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("gamification.leaderboard.settings.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="leaderboards-enabled"
          label={t("gamification.leaderboard.settings.enabled.label")}
          description={t("gamification.leaderboard.settings.enabled.description")}
          checked={globalSettings.leaderboardsEnabled}
          onCheckedChange={() =>
            updateLeaderboardSettings({ leaderboardsEnabled: !globalSettings.leaderboardsEnabled })
          }
          testId={LEADERBOARD_HANDLES.SETTINGS_ENABLED_SWITCH}
        />
        <div className="space-y-3 rounded-lg border p-3 shadow-sm">
          <div className="space-y-0.5">
            <p className="body-base-md">
              {t("gamification.leaderboard.settings.visibility.label")}
            </p>
            <p className="body-sm-md text-muted-foreground">
              {t("gamification.leaderboard.settings.visibility.description")}
            </p>
          </div>
          <RadioGroup
            value={globalSettings.leaderboardVisibility}
            disabled={isVisibilityDisabled}
            onValueChange={(value) =>
              updateLeaderboardSettings({ leaderboardVisibility: value as LeaderboardVisibility })
            }
            className="gap-3"
            data-testid={LEADERBOARD_HANDLES.SETTINGS_VISIBILITY}
          >
            {VISIBILITY_OPTIONS.map(({ value, key }) => (
              <div key={value} className="flex items-center gap-2">
                <RadioGroupItem id={`leaderboard-visibility-${value}`} value={value} />
                <Label htmlFor={`leaderboard-visibility-${value}`} className="cursor-pointer">
                  <span className="body-sm-md text-neutral-950">
                    {t(`gamification.leaderboard.settings.visibility.${key}.label`)}
                  </span>
                  <span className="body-sm text-muted-foreground">
                    {" · "}
                    {t(`gamification.leaderboard.settings.visibility.${key}.description`)}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
