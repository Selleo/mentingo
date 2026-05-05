import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import { useScormRuntime } from "./useScormRuntime";

import type { ScormLaunchData } from "./ScormLesson.types";
import type { SupportedLanguages } from "@repo/shared";

type ScormPlayerProps = {
  launch: ScormLaunchData;
  language: SupportedLanguages;
};

export function ScormPlayer({ launch, language }: ScormPlayerProps) {
  const { t } = useTranslation();
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
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
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
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
  );
}
