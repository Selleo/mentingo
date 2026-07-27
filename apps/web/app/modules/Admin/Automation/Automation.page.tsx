import { useNavigate } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateAutomation } from "~/api/mutations/admin/useCreateAutomation";
import { useDeleteAutomation } from "~/api/mutations/admin/useDeleteAutomation";
import { useAutomations } from "~/api/queries/admin/useAutomations";
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
import { Button } from "~/components/ui/button";

import { AutomationDrawer } from "./components/AutomationDrawer";
import { AutomationFilters, type StatusFilter } from "./components/AutomationFilters";
import { AutomationHeader } from "./components/AutomationHeader";
import { AutomationTable } from "./components/AutomationTable";

import type { AutomationListItem } from "~/api/queries/admin/automation.types";

export default function AutomationPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const { data: automations = [], isLoading } = useAutomations();
  const createAutomation = useCreateAutomation();
  const deleteAutomation = useDeleteAutomation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<AutomationListItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleCreate = () => {
    const lang = i18n.language || "pl";
    createAutomation.mutate({
      name: { [lang]: t("automationView.newAutomation.name") },
      description: { [lang]: t("automationView.newAutomation.description") },
      status: "draft",
    });
  };

  const handleOpenDrawer = (automation: AutomationListItem) => {
    setSelectedAutomation(automation);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedAutomation(null);
  };

  const handleRequestDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      deleteAutomation.mutate(deleteTargetId);
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" data-testid="automation-page">
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
        <AutomationTable
          automations={filteredAutomations}
          totalCount={automations.length}
          onOpenDrawer={handleOpenDrawer}
          isLoading={isLoading}
        />
      </div>

      <AutomationDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        automation={selectedAutomation}
        onDelete={handleRequestDelete}
        onEdit={handleEdit}
      />

      <div className="mt-4 flex justify-start">
        <Button
          variant="primary"
          className="px-3 py-1.5 text-sm w-auto"
          onClick={() => navigate("/admin/automation/logs")}
          data-testid="automation-page-open-logs-button"
        >
          {t("automationView.openLogs")}
        </Button>
      </div>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent data-testid="automation-page-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("automationView.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("automationView.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelDelete}
              data-testid="automation-page-delete-dialog-cancel"
            >
              {t("automationView.deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="automation-page-delete-dialog-confirm"
            >
              {t("automationView.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
