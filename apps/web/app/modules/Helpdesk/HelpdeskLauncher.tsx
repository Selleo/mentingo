import { CircleHelp } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

import type { HelpdeskSelection } from "./helpdesk.types";

const HelpdeskContent = lazy(() => import("./HelpdeskContent"));
const HelpdeskVideoDialog = lazy(() => import("./HelpdeskVideoDialog"));

export function HelpdeskLauncher() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<HelpdeskSelection | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            aria-label={t("helpdesk.title")}
            title={t("helpdesk.title")}
            className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 z-40 size-12 rounded-full border-neutral-200 bg-white p-0 text-primary-700 shadow-md hover:border-primary-300 hover:bg-primary-50 md:right-6"
          >
            <CircleHelp className="size-5 shrink-0" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={12}
          collisionPadding={12}
          className="w-[min(440px,calc(100vw-24px))] overflow-hidden border-neutral-200 bg-white p-0 shadow-xl"
          onCloseAutoFocus={(event) => {
            if (selection) event.preventDefault();
          }}
        >
          <Suspense
            fallback={
              <div
                className="h-96 animate-pulse bg-neutral-50"
                aria-label={t("helpdesk.loading")}
              />
            }
          >
            <HelpdeskContent
              onAskAssistant={() => setOpen(false)}
              onSelect={(next) => {
                setOpen(false);
                setSelection(next);
              }}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
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
            key={selection.tutorial.revisionId}
            selection={selection}
            onSelect={setSelection}
            onClose={() => setSelection(null)}
            onRestoreFocus={() => triggerRef.current?.focus()}
          />
        </Suspense>
      )}
    </>
  );
}
