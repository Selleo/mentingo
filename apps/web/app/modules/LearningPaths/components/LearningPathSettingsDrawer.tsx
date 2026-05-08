import { LEARNING_PATH_STATUSES } from "@repo/shared";
import { Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";

import type { GetLearningPathsResponse, UpdateLearningPathBody } from "~/api/generated-api";

type LearningPathListItem = GetLearningPathsResponse["data"][number];

type LearningPathSettingsDrawerProps = {
  status: LearningPathListItem["status"];
  sequenceEnabled: boolean;
  includesCertificate: boolean;
  isPending: boolean;
  onStatusChange: (status: UpdateLearningPathBody["status"]) => void;
  onSequenceEnabledChange: (sequenceEnabled: boolean) => void;
  onCertificateChange: (includesCertificate: boolean) => void;
};

export function LearningPathSettingsDrawer({
  status,
  sequenceEnabled,
  includesCertificate,
  isPending,
  onStatusChange,
  onSequenceEnabledChange,
  onCertificateChange,
}: LearningPathSettingsDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={isPending}
          aria-label={t("adminLearningPathsView.detailsSettings.title")}
        >
          <Settings className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bottom-0 left-auto right-0 top-0 mt-0 h-full w-full max-w-[520px] rounded-none border-l border-primary-100 bg-white p-0 shadow-xl [&>div:first-child]:hidden">
        <div className="flex items-start justify-between gap-4 border-b border-primary-100 px-6 py-6">
          <div>
            <DrawerTitle className="body-base-md text-primary-950">
              {t("adminLearningPathsView.detailsSettings.title")}
            </DrawerTitle>
            <DrawerDescription className="details-md mt-1 text-neutral-600">
              {t("adminLearningPathsView.detailsSettings.description")}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("common.button.close")}
              className="shrink-0 text-neutral-500 hover:text-neutral-900"
            >
              <X className="size-5" />
            </Button>
          </DrawerClose>
        </div>

        <div className="grid gap-6 px-6 py-6">
          <div className="grid gap-2">
            <label className="body-sm-md text-neutral-950">
              {t("adminLearningPathsView.form.status")}
            </label>
            <Select
              value={status}
              onValueChange={(value) => onStatusChange(value as UpdateLearningPathBody["status"])}
            >
              <SelectTrigger className="body-sm-md h-10 rounded-lg border-primary-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(LEARNING_PATH_STATUSES).map((statusValue) => (
                  <SelectItem key={statusValue} value={statusValue}>
                    {t(`learningPathsView.status.${statusValue}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="details-md text-neutral-600">
              {t("adminLearningPathsView.form.statusDescription")}
            </p>
          </div>
          <div className="border-t border-primary-100" />
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="body-sm-md text-neutral-950">
                {t("adminLearningPathsView.form.sequenceEnabled")}
              </p>
              <p className="details-md mt-1 text-neutral-600">
                {t("adminLearningPathsView.form.sequenceEnabledDescription")}
              </p>
            </div>
            <Switch
              checked={sequenceEnabled}
              onCheckedChange={onSequenceEnabledChange}
              disabled={isPending}
            />
          </div>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="body-sm-md text-neutral-950">
                {t("adminLearningPathsView.form.includesCertificate")}
              </p>
              <p className="details-md mt-1 text-neutral-600">
                {t("adminLearningPathsView.form.includesCertificateDescription")}
              </p>
            </div>
            <Switch
              checked={includesCertificate}
              onCheckedChange={onCertificateChange}
              disabled={isPending}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
