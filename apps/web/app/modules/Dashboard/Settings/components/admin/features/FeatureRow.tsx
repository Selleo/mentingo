import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Link } from "@remix-run/react";
import { LEADERBOARD_VISIBILITY, type LeaderboardVisibility } from "@repo/shared";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import {
  INTEGRATIONS_PAGE_PATH,
  PLATFORM_FEATURE_IDS,
  PLATFORM_FEATURE_OPTIONS,
  PLATFORM_FEATURE_STATUSES,
  type PlatformFeatureId,
} from "./platformFeatures.constants";

import type { PlatformFeature } from "./platformFeatures.types";

type FeatureRowProps = {
  feature: PlatformFeature;
  onToggle: (feature: PlatformFeature) => void;
};

type FeatureOptionProps = {
  feature: PlatformFeature;
};

const LEADERBOARD_VISIBILITY_OPTIONS = [
  { value: LEADERBOARD_VISIBILITY.CLOSED, key: "closed" },
  { value: LEADERBOARD_VISIBILITY.PUBLIC, key: "public" },
] as const;

/** Visitor-access wording each section used before the Features tab existed. */
const PUBLIC_ACCESS_TRANSLATION_KEYS: Partial<
  Record<PlatformFeatureId, { label: string; description: string; disabledTooltip: string }>
> = {
  [PLATFORM_FEATURE_IDS.NEWS]: {
    label: "newsPreferences.settings.newsPublic.label",
    description: "newsPreferences.settings.newsPublic.description",
    disabledTooltip: "newsPreferences.tooltip.disabled",
  },
  [PLATFORM_FEATURE_IDS.ARTICLES]: {
    label: "articlesPreferences.settings.articlesPublic.label",
    description: "articlesPreferences.settings.articlesPublic.description",
    disabledTooltip: "articlesPreferences.tooltip.disabled",
  },
  [PLATFORM_FEATURE_IDS.QA]: {
    label: "qaPreferences.settings.qaPublic.label",
    description: "qaPreferences.settings.qaPublic.description",
    disabledTooltip: "qaPreferences.tooltip.disabled",
  },
};

const isLeaderboardVisibility = (value: string): value is LeaderboardVisibility =>
  LEADERBOARD_VISIBILITY_OPTIONS.some((option) => option.value === value);

function PublicAccessOption({ feature }: FeatureOptionProps) {
  const { t } = useTranslation();
  const translationKeys = PUBLIC_ACCESS_TRANSLATION_KEYS[feature.definition.id];

  if (!translationKeys) return null;

  return (
    <SettingItem
      id={`${feature.definition.id}-public`}
      label={t(translationKeys.label)}
      description={t(translationKeys.description)}
      checked={feature.isPublic}
      onCheckedChange={() => feature.togglePublic?.()}
      disabled={!feature.isEnabled || feature.isPending}
      tooltipTranslationKey={translationKeys.disabledTooltip}
      testId={feature.definition.optionTestId}
    />
  );
}

function LeaderboardVisibilityOption({ feature }: FeatureOptionProps) {
  const { t } = useTranslation();
  const isDisabled = !feature.isEnabled || feature.isPending;
  const selectedOption = LEADERBOARD_VISIBILITY_OPTIONS.find(
    ({ value }) => value === feature.leaderboardVisibility,
  );

  return (
    <div
      className={cn(
        "flex flex-row items-center justify-between gap-4 rounded-lg border p-3 shadow-sm",
        isDisabled && "opacity-60",
      )}
    >
      <div className="space-y-0.5">
        <p className="body-base-md">{t("gamification.leaderboard.settings.visibility.label")}</p>
        <p className="body-sm-md text-muted-foreground">
          {selectedOption &&
            `${t(`gamification.leaderboard.settings.visibility.${selectedOption.key}.description`)} `}
          {t("gamification.leaderboard.settings.visibility.description")}
        </p>
      </div>
      <RadioGroupPrimitive.Root
        value={feature.leaderboardVisibility}
        disabled={isDisabled}
        onValueChange={(value) => {
          if (isLeaderboardVisibility(value)) feature.changeLeaderboardVisibility?.(value);
        }}
        aria-label={t("gamification.leaderboard.settings.visibility.label")}
        data-testid={feature.definition.optionTestId}
        className="inline-flex shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
      >
        {LEADERBOARD_VISIBILITY_OPTIONS.map(({ value, key }) => (
          <RadioGroupPrimitive.Item
            key={value}
            value={value}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium text-neutral-600 transition-colors",
              "hover:text-neutral-950 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              "data-[state=checked]:bg-white data-[state=checked]:text-primary-800 data-[state=checked]:shadow-sm",
            )}
          >
            {t(`gamification.leaderboard.settings.visibility.${key}.label`)}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}

export function FeatureRow({ feature, onToggle }: FeatureRowProps) {
  const { t } = useTranslation();
  const { definition, isEnabled, status, lockedReason, isPending } = feature;
  const needsSetup = status === PLATFORM_FEATURE_STATUSES.NEEDS_SETUP;
  const needsSetupDescription = needsSetup
    ? t("platformFeatures.needsSetup.description")
    : undefined;

  const option =
    definition.option &&
    match(definition.option)
      .with(PLATFORM_FEATURE_OPTIONS.PUBLIC_ACCESS, () => <PublicAccessOption feature={feature} />)
      .with(PLATFORM_FEATURE_OPTIONS.LEADERBOARD_VISIBILITY, () => (
        <LeaderboardVisibilityOption feature={feature} />
      ))
      .exhaustive();

  return (
    <div className="space-y-4" data-testid={`platform-feature-row-${definition.id}`}>
      <SettingItem
        id={definition.id}
        label={t(definition.labelKey)}
        description={t(definition.descriptionKey)}
        checked={isEnabled}
        onCheckedChange={() => onToggle(feature)}
        icon={<Icon name={definition.iconName} className="size-5 text-neutral-700" />}
        disabled={isPending || Boolean(lockedReason) || needsSetup}
        tooltip={
          lockedReason ??
          needsSetupDescription ??
          (definition.tooltipKey ? t(definition.tooltipKey) : undefined)
        }
        testId={definition.switchTestId}
      />

      {needsSetup && definition.requiredIntegration && (
        <Link
          to={`${INTEGRATIONS_PAGE_PATH}#${definition.requiredIntegration.envGroupId}`}
          className="body-sm-md -mt-2 inline-flex items-center gap-1 px-3 text-primary-700 underline-offset-2 hover:underline"
        >
          {t("platformFeatures.needsSetup.configure")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}

      {option}
    </div>
  );
}
