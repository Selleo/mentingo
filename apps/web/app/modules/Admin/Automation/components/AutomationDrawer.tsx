import { Archive, Play, Square, Trash2 } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateAutomation } from "~/api/mutations/admin/useUpdateAutomation";
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
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { toast as showToast } from "~/components/ui/use-toast";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useAutoSave } from "../hooks/useAutoSave";

import type { AutomationListItem, AutomationStatus } from "~/api/queries/admin/automation.types";

interface AutomationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  automation: AutomationListItem | null;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

const getAvailableStatuses = (currentStatus: AutomationStatus, t: (key: string) => string) => {
  if (currentStatus === "draft") {
    return [{ value: "draft", label: t("automationView.drawer.statusDraft") }];
  }

  return [
    { value: "enabled", label: t("automationView.drawer.statusEnabled") },
    { value: "disabled", label: t("automationView.drawer.statusDisabled") },
    { value: "archived", label: t("automationView.drawer.statusArchived") },
  ];
};

export const AutomationDrawer: FC<AutomationDrawerProps> = ({
  isOpen,
  onClose,
  automation,
  onDelete,
  onEdit,
}) => {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const updateAutomation = useUpdateAutomation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<AutomationStatus>("draft");
  const [showSimulationWarning, setShowSimulationWarning] = useState(false);
  const prevAutomationId = useRef<string | null>(null);

  const triggerAutoSave = useAutoSave<{
    name: string;
    description: string;
    status: AutomationStatus;
  }>((fields) => {
    if (automation) {
      updateAutomation.mutate({
        automationId: automation.id,
        body: {
          name: { [language]: fields.name },
          description: { [language]: fields.description },
          status: fields.status,
        },
        showSuccessToast: false,
      });
    }
  });

  useEffect(() => {
    if (automation) {
      if (automation.id !== prevAutomationId.current) {
        prevAutomationId.current = automation.id;
        setName(automation.name);
        setDescription(automation.description);
        setStatus(automation.status);
      } else {
        setStatus(automation.status);
      }
    } else {
      prevAutomationId.current = null;
    }
  }, [automation]);

  if (!automation) return null;

  const isDraft = automation.status === "draft";
  const availableStatuses = getAvailableStatuses(automation.status, t);

  const handleNameChange = (value: string) => {
    setName(value);
    triggerAutoSave({ name: value, description, status });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    triggerAutoSave({ name, description: value, status });
  };

  const handleStatusChange = (val: string) => {
    const newStatus = val as AutomationStatus;
    setStatus(newStatus);
    updateAutomation.mutate({
      automationId: automation.id,
      body: {
        name: { [language]: name },
        description: { [language]: description },
        status: newStatus,
      },
    });
  };

  const toggleActivation = () => {
    if (isDraft) {
      setShowSimulationWarning(true);
      showToast({
        description: t("automationView.drawer.simulationRequiredTooltip"),
        variant: "default",
        duration: 3000,
      });
      return;
    }
    const nextStatus: AutomationStatus = status === "enabled" ? "disabled" : "enabled";
    setStatus(nextStatus);
    updateAutomation.mutate({
      automationId: automation.id,
      body: { status: nextStatus },
    });
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
              onChange={(e) => handleNameChange(e.target.value)}
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
              onChange={(e) => handleDescriptionChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("automationView.drawer.statusLabel")}</Label>
            <Select value={status} onValueChange={handleStatusChange} disabled={isDraft}>
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

            <Button
              variant="outline"
              className="w-full"
              onClick={() => onEdit(automation.id)}
              data-testid="automation-drawer-open-builder-button"
            >
              {t("automationView.drawer.openBuilder")}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant="outline"
                        className={
                          "w-full border-success-200 bg-success-50 text-success-700 hover:bg-success-100"
                        }
                        onClick={toggleActivation}
                        disabled={status === "archived"}
                      >
                        {status === "enabled" ? (
                          <>
                            <Square className="mr-2 size-4" /> {t("automationView.drawer.pause")}
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 size-4" /> {t("automationView.drawer.activate")}
                          </>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {isDraft && (
                    <TooltipContent side="top">
                      {t("automationView.drawer.simulationRequiredTooltip")}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="outline"
                onClick={() => {
                  setStatus("archived");
                  updateAutomation.mutate({
                    automationId: automation.id,
                    body: { status: "archived" },
                  });
                }}
                disabled={status === "archived" || isDraft}
              >
                <Archive className="mr-2 size-4" /> {t("automationView.drawer.archive")}
              </Button>
            </div>

            {showSimulationWarning && isDraft && (
              <p className="text-xs text-amber-600">
                {t("automationView.drawer.simulationRequiredTooltip")}
              </p>
            )}
          </div>

          <Separator />

          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDelete(automation.id)}
            data-testid="automation-drawer-delete-button"
          >
            <Trash2 className="mr-2 size-4" /> {t("automationView.drawer.delete")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
