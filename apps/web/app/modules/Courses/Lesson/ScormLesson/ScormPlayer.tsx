import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import { useScormRuntime } from "./useScormRuntime";

import type { ScormLaunchData } from "./ScormLesson.types";
import type { SupportedLanguages } from "@repo/shared";

type ScormPlayerProps = {
  launch: ScormLaunchData;
  language: SupportedLanguages;
};

type ScormDialogMessage = {
  kind: "alert" | "confirm";
  message: string;
};

function isScormDialogMessage(value: unknown): value is ScormDialogMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "mentingo:scorm-dialog" &&
    "message" in value &&
    typeof value.message === "string" &&
    "kind" in value &&
    (value.kind === "alert" || value.kind === "confirm")
  );
}

function ScormPackageDialog({
  message,
  onClose,
}: {
  message: ScormDialogMessage | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={Boolean(message)} onOpenChange={onClose}>
      <DialogContent data-testid={LEARNING_HANDLES.SCORM_PACKAGE_DIALOG}>
        <DialogHeader>
          <DialogTitle>{t("studentLessonView.scorm.packageDialogTitle")}</DialogTitle>
          <DialogDescription>{message?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {message?.kind === "confirm" && (
            <Button
              data-testid={LEARNING_HANDLES.SCORM_PACKAGE_DIALOG_CANCEL_BUTTON}
              variant="outline"
              onClick={onClose}
            >
              {t("common.button.cancel")}
            </Button>
          )}
          <Button data-testid={LEARNING_HANDLES.SCORM_PACKAGE_DIALOG_OK_BUTTON} onClick={onClose}>
            {t("studentLessonView.scorm.packageDialogOk")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScormPlayer({ launch, language }: ScormPlayerProps) {
  const { t } = useTranslation();
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [dialogMessage, setDialogMessage] = useState<ScormDialogMessage | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useScormRuntime({ launch, language });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void fullscreenRef.current?.requestFullscreen();
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isScormDialogMessage(event.data)) {
        return;
      }

      setDialogMessage({
        kind: event.data.kind,
        message: event.data.message,
      });
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <>
      <div
        ref={fullscreenRef}
        data-testid={LEARNING_HANDLES.SCORM_ROOT}
        className="flex min-h-[70vh] w-full flex-col gap-2 bg-white data-[fullscreen=true]:h-screen data-[fullscreen=true]:p-4"
        data-fullscreen={isFullscreen}
      >
        <div className="flex justify-end">
          <Button
            type="button"
            data-testid={LEARNING_HANDLES.SCORM_FULLSCREEN_BUTTON}
            variant="outline"
            size="sm"
            className="gap-2 bg-white"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {isFullscreen ? t("common.exitFullscreen") : t("common.enterFullscreen")}
          </Button>
        </div>
        <section className="flex min-h-[70vh] w-full flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <iframe
            data-testid={LEARNING_HANDLES.SCORM_IFRAME}
            key={launch.scoId}
            src={launch.launchUrl}
            title={launch.scoTitle}
            className="min-h-[70vh] w-full flex-1 bg-white"
            allowFullScreen
          />
        </section>
      </div>
      <ScormPackageDialog message={dialogMessage} onClose={() => setDialogMessage(null)} />
    </>
  );
}
