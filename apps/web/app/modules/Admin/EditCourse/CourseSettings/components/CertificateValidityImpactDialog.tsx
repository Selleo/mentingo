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

type CertificateValidityImpact = {
  activeCertificateCount: number;
  immediatelyExpiringCertificateCount: number;
};

type CertificateValidityImpactDialogProps = {
  open: boolean;
  impact: CertificateValidityImpact | null;
  isEnablingValidity: boolean;
  onOpenChange: (open: boolean) => void;
  onFutureOnly: () => void;
  onApplyToExisting: () => void;
};

export function CertificateValidityImpactDialog({
  open,
  impact,
  isEnablingValidity,
  onOpenChange,
  onFutureOnly,
  onApplyToExisting,
}: CertificateValidityImpactDialogProps) {
  const { t } = useTranslation();

  const { activeCertificateCount = 0, immediatelyExpiringCertificateCount = 0 } = impact ?? {};

  const hasActiveCertificates = activeCertificateCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-5">
          <DialogHeader>
            <DialogTitle>
              {t("adminCourseView.settings.other.confirmValidityChangesTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("adminCourseView.settings.other.enableCertificateValidityConfirmationDescription")}
            </DialogDescription>
          </DialogHeader>

          {hasActiveCertificates ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                <p className="text-sm text-neutral-700">
                  {t("adminCourseView.settings.other.activeCertificatesStat")}
                </p>
                <p className="text-sm font-medium text-neutral-950">{activeCertificateCount}</p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                <p className="text-sm text-neutral-700">
                  {t("adminCourseView.settings.other.immediatelyExpiringStat")}
                </p>
                <p className="text-sm font-medium text-neutral-950">
                  {immediatelyExpiringCertificateCount}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              {t("adminCourseView.settings.other.noActiveCertificatesValidityDescription")}
            </div>
          )}

          <DialogFooter className="gap-2 sm:flex-wrap sm:justify-end sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              {t("common.button.cancel")}
            </Button>
            {hasActiveCertificates ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full whitespace-normal sm:w-auto"
                  onClick={onFutureOnly}
                >
                  {t("adminCourseView.settings.button.futureOnly")}
                </Button>
                <Button
                  type="button"
                  className="w-full whitespace-normal sm:w-auto"
                  onClick={onApplyToExisting}
                >
                  {t("adminCourseView.settings.button.applyToExisting")}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="w-full whitespace-normal sm:w-auto"
                onClick={onFutureOnly}
              >
                {t(
                  isEnablingValidity
                    ? "adminCourseView.settings.other.enableCertificateValidityConfirmationConfirm"
                    : "adminCourseView.settings.button.saveValidity",
                )}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
