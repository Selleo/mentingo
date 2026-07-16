import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

import { AutomationDrawer } from "./components/AutomationDrawer";
import { AutomationFilters, type StatusFilter } from "./components/AutomationFilters";
import { AutomationHeader } from "./components/AutomationHeader";
import { AutomationTable } from "./components/AutomationTable";

export interface Automation {
  id: string;
  name: string;
  description: string;
  status: "Enabled" | "Disabled" | "Draft" | "Archived";
  trigger: string;
  actionsCount: number;
  lastRun: {
    date: string;
    status: "success" | "failed" | "never";
  };
  updatedAt: string;
}

const INITIAL_DATA: Automation[] = [
  {
    id: "1",
    name: "Kurs przypisany - Powiadomienie",
    description: "Wysyła email do uczestnika zaraz po przypisaniu do kursu.",
    status: "Enabled",
    trigger: "learner.assigned",
    actionsCount: 1,
    lastRun: { date: "2026-07-15 08:12", status: "success" },
    updatedAt: "2026-07-10",
  },
  {
    id: "2",
    name: "Przypomnienie o certyfikacie",
    description: "Wysyłane 30 dni przed wygaśnięciem certyfikatu.",
    status: "Disabled",
    trigger: "certificate.expiring",
    actionsCount: 2,
    lastRun: { date: "2026-07-12 11:00", status: "failed" },
    updatedAt: "2026-07-12",
  },
  {
    id: "3",
    name: "Nowe szkolenie Live",
    description: "Szkic powiadomienia o nadchodzących warsztatach.",
    status: "Draft",
    trigger: "live_training.scheduled",
    actionsCount: 1,
    lastRun: { date: "-", status: "never" },
    updatedAt: "2026-07-15",
  },
];

export async function clientLoader() {
  return { initialAutomations: INITIAL_DATA };
}

export default function AutomationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { initialAutomations } = useLoaderData<typeof clientLoader>();

  const [automations, setAutomations] = useState<Automation[]>(initialAutomations);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleCreate = () => {
    const newAutomation: Automation = {
      id: Date.now().toString(),
      name: t("automationView.newAutomation.name"),
      description: t("automationView.newAutomation.description"),
      status: "Draft",
      trigger: t("automationView.newAutomation.triggerPlaceholder"),
      actionsCount: 0,
      lastRun: { date: "-", status: "never" },
      updatedAt: new Date().toISOString().split("T")[0],
    };
    setAutomations((prev) => [newAutomation, ...prev]);
  };

  const handleOpenDrawer = (automation: Automation) => {
    setSelectedAutomation(automation);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedAutomation(null);
  };

  const handleUpdate = (id: string, updatedFields: Partial<Automation>) => {
    setAutomations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = {
            ...item,
            ...updatedFields,
            updatedAt: new Date().toISOString().split("T")[0],
          };

          if (selectedAutomation?.id === id) {
            setSelectedAutomation(updatedItem);
          }

          return updatedItem;
        }
        return item;
      }),
    );
  };

  const handleRequestDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      setAutomations((prev) => prev.filter((item) => item.id !== deleteTargetId));
      if (selectedAutomation?.id === deleteTargetId) {
        handleCloseDrawer();
      }
      setDeleteTargetId(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteTargetId(null);
  };

  const handleEdit = (id: string) => {
    navigate(`/admin/automation/${id}/builder`);
  };

  const filteredAutomations = automations.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "All" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AutomationHeader onCreate={handleCreate} />

      <div className="mt-8">
        <AutomationFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      </div>

      <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
        <AutomationTable automations={filteredAutomations} onOpenDrawer={handleOpenDrawer} />
      </div>

      <AutomationDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        automation={selectedAutomation}
        onUpdate={handleUpdate}
        onDelete={handleRequestDelete}
        onEdit={handleEdit}
      />

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("automationView.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("automationView.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>
              {t("automationView.deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("automationView.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
