import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

import { FeatureDisableDialog } from "./FeatureDisableDialog";
import { FeatureRow } from "./FeatureRow";
import { PLATFORM_FEATURE_SECTIONS } from "./platformFeatures.constants";
import { usePlatformFeatures } from "./usePlatformFeatures";

import type { PlatformFeature } from "./platformFeatures.types";
import type { GlobalSettings } from "~/modules/Dashboard/Settings/types";

type FeaturesTabContentProps = {
  globalSettings: GlobalSettings;
  canManageEnvs: boolean;
};

export function FeaturesTabContent({ globalSettings, canManageEnvs }: FeaturesTabContentProps) {
  const { t } = useTranslation();
  const features = usePlatformFeatures(globalSettings, canManageEnvs);
  const [featurePendingDisable, setFeaturePendingDisable] = useState<PlatformFeature | null>(null);

  const sections = PLATFORM_FEATURE_SECTIONS.map((section) => ({
    section,
    features: features.filter(({ definition }) => section.featureIds.includes(definition.id)),
  })).filter(({ features: sectionFeatures }) => sectionFeatures.length > 0);

  const toggleFeature = (feature: PlatformFeature) => {
    if (feature.isEnabled) return setFeaturePendingDisable(feature);

    feature.toggle();
  };

  return (
    <div className="flex flex-col gap-6" data-testid="platform-features">
      {sections.map(({ section, features: sectionFeatures }) => (
        <Card key={section.id} id={`${section.id}-preferences`} data-testid={section.testId}>
          <CardHeader>
            <CardTitle className="h5">{t(section.titleKey)}</CardTitle>
            <CardDescription className="body-lg-md">{t(section.descriptionKey)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sectionFeatures.map((feature) => (
              <FeatureRow key={feature.definition.id} feature={feature} onToggle={toggleFeature} />
            ))}
          </CardContent>
        </Card>
      ))}

      <FeatureDisableDialog
        feature={featurePendingDisable}
        onCancel={() => setFeaturePendingDisable(null)}
        onConfirm={(feature) => {
          feature.toggle();
          setFeaturePendingDisable(null);
        }}
      />
    </div>
  );
}
