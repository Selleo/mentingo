import { PERMISSIONS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
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

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_CONFIRMATION_HINTS,
} from "../emailTemplates.constants";

import type {
  EmailTemplatePublicationConflict,
  EmailTemplateConfirmationAction,
} from "../emailTemplates.types";

export type EmailTemplateConfirmationProps = {
  action: EmailTemplateConfirmationAction;
  publicationConflicts?: EmailTemplatePublicationConflict[];
  errorMessage?: string;
  isActionPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function EmailTemplateConfirmation({
  action,
  publicationConflicts = [],
  errorMessage,
  isActionPending,
  onConfirm,
  onClose,
}: EmailTemplateConfirmationProps) {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const canManageAutomations = hasPermission(user?.permissions, PERMISSIONS.AUTOMATION_MANAGE);
  const needsDeactivation =
    action === EMAIL_TEMPLATE_ACTIONS.PUBLISH && publicationConflicts.length > 0;
  const actionLabel = needsDeactivation
    ? t("emailTemplates.ui.publishAndDeactivate")
    : t(`emailTemplates.ui.${action ?? EMAIL_TEMPLATE_ACTIONS.PUBLISH}`);
  return (
    <Dialog
      open={Boolean(action)}
      onOpenChange={(open) => {
        if (!open && !isActionPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {needsDeactivation ? t("emailTemplates.ui.publishDeactivateTitle") : actionLabel}
          </DialogTitle>
          <DialogDescription>
            {needsDeactivation
              ? t("emailTemplates.ui.publishDeactivateHint")
              : t(EMAIL_TEMPLATE_CONFIRMATION_HINTS[action ?? EMAIL_TEMPLATE_ACTIONS.PUBLISH])}
          </DialogDescription>
        </DialogHeader>
        {needsDeactivation && (
          <ul className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm">
            {publicationConflicts.map((automation) => (
              <li key={automation.id}>
                <p className="font-medium">{automation.name}</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {[
                    ...new Set(
                      automation.issues.flatMap((issue) =>
                        issue.placeholder ? [issue.placeholder] : [],
                      ),
                    ),
                  ].map((placeholder) => (
                    <li key={placeholder}>
                      <code>{`{{ ${placeholder} }}`}</code>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {needsDeactivation && !canManageAutomations && (
          <p role="alert" className="text-sm text-destructive">
            {t("auth.error.missingPermission")}
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isActionPending}
            data-testid={EMAIL_TEMPLATES_HANDLES.CANCEL}
            onClick={onClose}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            variant={
              action === EMAIL_TEMPLATE_ACTIONS.DELETE || needsDeactivation
                ? "destructive"
                : "default"
            }
            disabled={isActionPending || (needsDeactivation && !canManageAutomations)}
            data-testid={EMAIL_TEMPLATES_HANDLES.CONFIRM}
            onClick={onConfirm}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
