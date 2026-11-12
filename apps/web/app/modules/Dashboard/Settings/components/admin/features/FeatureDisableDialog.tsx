import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../../e2e/data/settings/handles";

import type { PlatformFeature } from "./platformFeatures.types";

type FeatureDisableDialogProps = {
  feature: PlatformFeature | null;
  onCancel: () => void;
  onConfirm: (feature: PlatformFeature) => void;
};

/** Reassures the admin that switching a feature off hides it without deleting anything. */
export function FeatureDisableDialog({ feature, onCancel, onConfirm }: FeatureDisableDialogProps) {
  const { t } = useTranslation();
  const featureTitle = feature ? t(`platformFeatures.items.${feature.definition.id}.title`) : "";

  return (
    <Dialog open={Boolean(feature)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-w-md"
        data-testid={SETTINGS_PAGE_HANDLES.FEATURE_DISABLE_DIALOG}
      >
        <DialogHeader>
          <DialogTitle>
            {t("platformFeatures.disable.title", { feature: featureTitle })}
          </DialogTitle>
          <DialogDescription>{t("platformFeatures.disable.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {t("common.button.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => feature && onConfirm(feature)}
            data-testid={SETTINGS_PAGE_HANDLES.FEATURE_DISABLE_CONFIRM_BUTTON}
          >
            {t("platformFeatures.disable.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
