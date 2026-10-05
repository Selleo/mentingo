import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRenewScormContent } from "~/api/mutations/useRenewScormContent";
import { Button } from "~/components/ui/button";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import { parseScormLaunch } from "./scormBridge";
import { useScormRuntime } from "./useScormRuntime";

import type { ScormLaunchData } from "./ScormLesson.types";
import type { SupportedLanguages } from "@repo/shared";

type ScormPlayerProps = {
  launch: ScormLaunchData;
  language: SupportedLanguages;
  onSavingChange?: (isSaving: boolean) => void;
};

export function ScormPlayer({ launch, language, onSavingChange }: ScormPlayerProps) {
  const { t } = useTranslation();
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const { mutateAsync: renew } = useRenewScormContent();
  const bridge = useMemo(
    () =>
      typeof window !== "undefined"
        ? parseScormLaunch(launch.launchUrl, window.location.origin)
        : null,
    [launch.launchUrl],
  );

  useScormRuntime({ launch, frame: frameRef, language, onSavingChange });

  useEffect(() => {
    setAccessible(false);
    if (!bridge) return;
    let active = true;
    const check = async () => {
      try {
        await renew(bridge.channel);
        if (active) setAccessible(true);
      } catch {
        if (active) setAccessible(false);
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 5 * 60 * 1000);
    const onOnline = () => void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [bridge, renew]);

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
          ref={frameRef}
          data-testid={LEARNING_HANDLES.SCORM_IFRAME}
          key={launch.scoId}
          src={accessible && bridge ? launch.launchUrl : "about:blank"}
          title={launch.scoTitle}
          className="min-h-[70vh] w-full flex-1 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"
        />
      </section>
    </div>
  );
}
