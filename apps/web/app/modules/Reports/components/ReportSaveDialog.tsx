import { Save } from "lucide-react";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type ReportVisibility = "personal" | "shared";

type ReportSaveDialogProps = {
  open: boolean;
  name: string;
  visibility: ReportVisibility;
  canManageShared: boolean;
  isUpdate: boolean;
  isPending: boolean;
  onNameChange: (name: string) => void;
  onVisibilityChange: (visibility: ReportVisibility) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
};

export function ReportSaveDialog({
  open,
  name,
  visibility,
  canManageShared,
  isUpdate,
  isPending,
  onNameChange,
  onVisibilityChange,
  onOpenChange,
  onSave,
}: ReportSaveDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reports.saved.saveConfiguration")}</DialogTitle>
          <DialogDescription>{t("reports.saved.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) onSave();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="report-configuration-name">{t("reports.saved.name")}</Label>
            <Input
              id="report-configuration-name"
              value={name}
              maxLength={120}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-configuration-visibility">{t("reports.saved.visibility")}</Label>
            <Select
              value={visibility}
              onValueChange={(value) => onVisibilityChange(value as ReportVisibility)}
            >
              <SelectTrigger id="report-configuration-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">{t("reports.saved.personal")}</SelectItem>
                {canManageShared && (
                  <SelectItem value="shared">{t("reports.saved.shared")}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending} className="gap-2">
              <Save className="size-4" />
              {isUpdate ? t("reports.saved.update") : t("reports.saved.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
