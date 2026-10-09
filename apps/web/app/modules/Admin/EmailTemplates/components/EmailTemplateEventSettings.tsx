import { useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { ArrowRight, Workflow, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateAutomation } from "~/api/mutations/automations/useCreateAutomation";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useEmailTemplateEvents } from "~/api/queries/useEmailTemplateEvents";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AutomationSearchSelect } from "../../Automations/Builder/components/AutomationSearchSelect";
import { AUTOMATION_WORKSPACE_PATH } from "../../Automations/Workspace/workspace.constants";
import { EMAIL_TEMPLATE_STATUSES } from "../emailTemplates.constants";
import { buildAutomationDraftForEmailTemplate } from "../utils/buildAutomationDraftForEmailTemplate";

import type { EmailTemplate } from "../emailTemplates.types";
import type { AutomationEventDefinition, AutomationEventKind } from "@repo/shared";

interface EmailTemplateEventSettingsProps {
  template: EmailTemplate;
  eventKind: AutomationEventKind | null;
  disabled: boolean;
  hasUnsavedChanges: boolean;
  onEventChange: (event: AutomationEventDefinition | null, replaceTags: boolean) => void;
}

export function EmailTemplateEventSettings({
  template,
  eventKind,
  disabled,
  hasUnsavedChanges,
  onEventChange,
}: EmailTemplateEventSettingsProps) {
  const { t } = useTranslation();
  const [pendingEvent, setPendingEvent] = useState<{
    event: AutomationEventDefinition | null;
  } | null>(null);

  function confirmEventChange(replaceTags: boolean) {
    if (!pendingEvent) return;

    onEventChange(pendingEvent.event, replaceTags);
    setPendingEvent(null);
  }
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const { data: user } = useCurrentUser();
  const { data: events, isPending: isLoadingEvents, isError, refetch } = useEmailTemplateEvents();
  const { mutateAsync: createAutomation, isPending: isCreating } = useCreateAutomation();
  const selectedEvent = events?.find((event) => event.kind === eventKind);
  const canManageAutomations = hasPermission(user?.permissions, PERMISSIONS.AUTOMATION_MANAGE);
  const hasCurrentPublication =
    template.status === EMAIL_TEMPLATE_STATUSES.PUBLISHED && !template.hasUnpublishedChanges;
  const canCreateAutomation =
    !disabled &&
    !hasUnsavedChanges &&
    hasCurrentPublication &&
    Boolean(selectedEvent && template.id);

  function getCreateAutomationHint() {
    if (isError) return t("emailTemplates.ui.requestFailed");
    if (!eventKind) return t("emailTemplates.ui.selectEvent");
    if (hasUnsavedChanges || !hasCurrentPublication)
      return t("emailTemplates.ui.publishBeforeAutomation");

    return t("emailTemplates.ui.automationDraftHint");
  }

  async function handleCreateAutomation() {
    if (!canCreateAutomation || !selectedEvent || !template.id || isCreating) return;

    const name =
      template.name[language] || template.name[template.baseLanguage] || t("automations.title");
    const draft = buildAutomationDraftForEmailTemplate(
      { ...template, id: template.id },
      selectedEvent,
      name,
    );

    try {
      const automation = await createAutomation(draft);

      navigate(`${AUTOMATION_WORKSPACE_PATH}/${automation.id}`);
    } catch {
      // The mutation displays the translated API error and keeps the editor open.
    }
  }

  return (
    <>
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full space-y-2 sm:w-auto sm:min-w-80 sm:max-w-md sm:flex-1">
            <p className="text-sm font-medium text-neutral-800">
              {t("emailTemplates.ui.intendedEvent")}
            </p>
            <div className="flex w-full items-center gap-1">
              <div className="min-w-0 flex-1">
                <AutomationSearchSelect
                  value={eventKind ?? ""}
                  label={t("emailTemplates.ui.intendedEvent")}
                  placeholder={t("emailTemplates.ui.selectEvent")}
                  disabled={disabled || isCreating || isLoadingEvents || isError}
                  groups={[
                    {
                      options: (events ?? []).map((event) => ({
                        value: event.kind,
                        label: t(`emailTemplates.events.${event.kind}`, {
                          defaultValue: event.label,
                        }),
                      })),
                    },
                  ]}
                  onValueChange={(value) => {
                    const event = events?.find((event) => event.kind === value);

                    if (event && event.kind !== eventKind) setPendingEvent({ event });
                  }}
                />
              </div>
              {eventKind && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isCreating}
                  aria-label={t("emailTemplates.ui.clearEvent")}
                  title={t("emailTemplates.ui.clearEvent")}
                  onClick={() => setPendingEvent({ event: null })}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
          {canManageAutomations && template.id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex w-full sm:w-auto",
                      (!canCreateAutomation || isCreating) && "cursor-not-allowed",
                    )}
                  >
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canCreateAutomation || isCreating}
                      className="w-full gap-2 px-5 shadow-sm disabled:border disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:opacity-100 disabled:shadow-none sm:w-auto"
                      onClick={() => void handleCreateAutomation()}
                    >
                      <Workflow className="size-4" />
                      {t("emailTemplates.ui.createAutomation")}
                      <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canCreateAutomation && (
                  <TooltipContent className="max-w-xs">{getCreateAutomationHint()}</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {isError && (
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {t("emailTemplates.ui.retry")}
          </Button>
        )}
      </section>
      <Dialog
        open={Boolean(pendingEvent)}
        onOpenChange={(open) => {
          if (!open) setPendingEvent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emailTemplates.ui.changeEventTitle")}</DialogTitle>
            <DialogDescription>{t("emailTemplates.ui.changeEventHint")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setPendingEvent(null)}>
              {t("common.button.cancel")}
            </Button>
            <Button variant="outline" onClick={() => confirmEventChange(false)}>
              {t("emailTemplates.ui.keepEventTags")}
            </Button>
            <Button onClick={() => confirmEventChange(true)}>
              {t("emailTemplates.ui.replaceEventTags")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
