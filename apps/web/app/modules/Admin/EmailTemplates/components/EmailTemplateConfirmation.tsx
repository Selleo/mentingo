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

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_ACTIONS,
  EMAIL_TEMPLATE_CONFIRMATION_HINTS,
} from "../emailTemplates.constants";

import type { EmailTemplateConfirmationAction } from "../emailTemplates.types";

export type EmailTemplateConfirmationProps = {
  action: EmailTemplateConfirmationAction;
  isActionPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function EmailTemplateConfirmation({
  action,
  isActionPending,
  onConfirm,
  onClose,
}: EmailTemplateConfirmationProps) {
  const { t } = useTranslation();
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
            {t(`emailTemplates.ui.${action ?? EMAIL_TEMPLATE_ACTIONS.PUBLISH}`)}
          </DialogTitle>
          <DialogDescription>
            {t(EMAIL_TEMPLATE_CONFIRMATION_HINTS[action ?? EMAIL_TEMPLATE_ACTIONS.PUBLISH])}
          </DialogDescription>
        </DialogHeader>
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
            variant={action === EMAIL_TEMPLATE_ACTIONS.DELETE ? "destructive" : "default"}
            disabled={isActionPending}
            data-testid={EMAIL_TEMPLATES_HANDLES.CONFIRM}
            onClick={onConfirm}
          >
            {t(`emailTemplates.ui.${action ?? EMAIL_TEMPLATE_ACTIONS.PUBLISH}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
