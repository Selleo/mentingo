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
  onOpenChange: (open: boolean) => void;
  onFutureOnly: () => void;
  onApplyToExisting: () => void;
};

export function CertificateValidityImpactDialog({
  open,
  impact,
  onOpenChange,
  onFutureOnly,
  onApplyToExisting,
}: CertificateValidityImpactDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("adminCourseView.settings.other.applyValidityTitle")}</DialogTitle>
            <DialogDescription>
              {t("adminCourseView.settings.other.applyValidityDescription", {
                activeCount: impact?.activeCertificateCount ?? 0,
                expiringCount: impact?.immediatelyExpiringCertificateCount ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFutureOnly}>
              {t("adminCourseView.settings.button.futureOnly")}
            </Button>
            <Button type="button" onClick={onApplyToExisting}>
              {t("adminCourseView.settings.button.applyToExisting")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
