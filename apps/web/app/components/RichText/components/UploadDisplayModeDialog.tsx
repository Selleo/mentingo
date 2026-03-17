import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";

import type { RichTextResourceDisplayMode } from "~/hooks/useEntityResourceUpload";

type UploadDisplayModeDialogProps = {
  open: boolean;
  fileName: string | null;
  mode: RichTextResourceDisplayMode;
  onModeChange: (mode: RichTextResourceDisplayMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const UploadDisplayModeDialog = ({
  open,
  fileName,
  mode,
  onModeChange,
  onCancel,
  onConfirm,
}: UploadDisplayModeDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("richText.uploadDisplayModeDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("richText.uploadDisplayModeDialog.description", { name: fileName ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={(value) => onModeChange(value as RichTextResourceDisplayMode)}
          className="gap-3"
        >
          {(["preview", "download"] as const).map((option) => (
            <Label
              key={option}
              htmlFor={`upload-display-mode-${option}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                mode === option ? "border-primary-600 bg-primary-50" : "border-neutral-200",
              )}
            >
              <RadioGroupItem
                id={`upload-display-mode-${option}`}
                value={option}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-neutral-950">
                  {t(`richText.uploadDisplayModeDialog.options.${option}.title`)}
                </span>
                <span className="text-xs text-neutral-600">
                  {t(`richText.uploadDisplayModeDialog.options.${option}.description`)}
                </span>
              </div>
            </Label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.button.cancel")}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t("common.button.proceed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
