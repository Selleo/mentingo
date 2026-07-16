import { Trash2, Save, Play, Square, Archive } from "lucide-react";
import { type FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";

import type { Automation } from "../Automation.page";

interface AutomationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  automation: Automation | null;
  onUpdate: (id: string, updatedFields: Partial<Automation>) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

const getAvailableStatuses = (currentStatus: Automation["status"], t: (key: string) => string) => {
  if (currentStatus === "Draft") {
    return [{ value: "Draft", label: t("automationView.drawer.statusDraft") }];
  }

  return [
    { value: "Enabled", label: t("automationView.drawer.statusEnabled") },
    { value: "Disabled", label: t("automationView.drawer.statusDisabled") },
    { value: "Archived", label: t("automationView.drawer.statusArchived") },
  ];
};

export const AutomationDrawer: FC<AutomationDrawerProps> = ({
  isOpen,
  onClose,
  automation,
  onUpdate,
  onDelete,
  onEdit,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Automation["status"]>("Draft");

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setDescription(automation.description);
      setStatus(automation.status);
    }
  }, [automation]);

  if (!automation) return null;

  const isDraft = automation.status === "Draft";
  const availableStatuses = getAvailableStatuses(automation.status, t);

  const handleSave = () => {
    onUpdate(automation.id, { name, description, status });
    onClose();
  };

  const toggleActivation = () => {
    const nextStatus: Automation["status"] = status === "Enabled" ? "Disabled" : "Enabled";
    setStatus(nextStatus);
    onUpdate(automation.id, { status: nextStatus });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("automationView.drawer.title")}</SheetTitle>
          <SheetDescription>{t("automationView.drawer.description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 py-6">
          <div className="space-y-2">
            <Label htmlFor="drawer-automation-name">{t("automationView.drawer.nameLabel")}</Label>
            <Input
              id="drawer-automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="drawer-automation-desc">
              {t("automationView.drawer.descriptionLabel")}
            </Label>
            <Textarea
              id="drawer-automation-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("automationView.drawer.statusLabel")}</Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as Automation["status"])}
              disabled={isDraft}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("automationView.drawer.flowManagement")}
            </p>

            <Button variant="outline" className="w-full" onClick={() => onEdit(automation.id)}>
              {t("automationView.drawer.openBuilder")}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className={
                  status === "Enabled"
                    ? "border-warning-200 bg-warning-50 text-warning-700 hover:bg-warning-100"
                    : "border-success-200 bg-success-50 text-success-700 hover:bg-success-100"
                }
                onClick={toggleActivation}
                disabled={status === "Archived" || isDraft}
              >
                {status === "Enabled" ? (
                  <>
                    <Square className="mr-2 size-4" /> {t("automationView.drawer.pause")}
                  </>
                ) : (
                  <>
                    <Play className="mr-2 size-4" /> {t("automationView.drawer.activate")}
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setStatus("Archived");
                  onUpdate(automation.id, { status: "Archived" });
                }}
                disabled={status === "Archived" || isDraft}
              >
                <Archive className="mr-2 size-4" /> {t("automationView.drawer.archive")}
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-between border-t pt-4">
          <Button variant="destructive" size="sm" onClick={() => onDelete(automation.id)}>
            <Trash2 className="mr-2 size-4" /> {t("automationView.drawer.delete")}
          </Button>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              {t("automationView.drawer.cancel")}
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 size-4" /> {t("automationView.drawer.save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
