import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

import type { HelpdeskSelection } from "./self-onboarding.types";

const HelpdeskContent = lazy(() => import("./SelfOnboardingContent"));
const HelpdeskVideoDialog = lazy(() => import("./SelfOnboardingVideoDialog"));

type HelpdeskLauncherProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreFocus: () => void;
  onAskAssistant: () => void;
};

export function HelpdeskLauncher({
  open,
  onOpenChange,
  onRestoreFocus,
  onAskAssistant,
}: HelpdeskLauncherProps) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<HelpdeskSelection | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          className="w-[min(440px,calc(100vw-24px))] gap-0 overflow-hidden rounded-xl border-neutral-200 bg-white p-0 shadow-xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!selection) onRestoreFocus();
          }}
        >
          <DialogTitle className="sr-only">{t("helpdesk.title")}</DialogTitle>
          <Suspense
            fallback={
              <div
                className="h-96 animate-pulse bg-neutral-50"
                aria-label={t("helpdesk.loading")}
              />
            }
          >
            <HelpdeskContent
              onAskAssistant={() => {
                onOpenChange(false);
                onAskAssistant();
              }}
              onSelect={(next) => {
                onOpenChange(false);
                setSelection(next);
              }}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
      {selection && (
        <Suspense
          fallback={
            <Dialog
              open
              onOpenChange={(next) => {
                if (!next) setSelection(null);
              }}
            >
              <DialogContent>
                <DialogTitle className="sr-only">{t("helpdesk.loading")}</DialogTitle>
                <div className="aspect-video animate-pulse rounded-lg bg-neutral-100" />
              </DialogContent>
            </Dialog>
          }
        >
          <HelpdeskVideoDialog
            selection={selection}
            onSelect={setSelection}
            onClose={() => setSelection(null)}
            onRestoreFocus={onRestoreFocus}
          />
        </Suspense>
      )}
    </>
  );
}
