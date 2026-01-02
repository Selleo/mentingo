import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import Loader from "~/modules/common/Loader/Loader";

import type { LessonResource } from "~/modules/Admin/EditCourse/EditCourse.types";

interface EmbedFrameProps {
  resource: LessonResource;
  title: string;
}

export const EmbedFrame = ({ resource, title }: EmbedFrameProps) => {
  const { t } = useTranslation();

  const [isloaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const handleLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    frameRef.current = e.currentTarget;
    setIsLoaded(true);
  };
  const handleError = () => setHasFailed(true);

  useEffect(() => {
    if (isloaded || hasFailed) return;

    const failTimeout = setTimeout(() => {
      setHasFailed(true);
    }, 30000); // 30 seconds

    return () => clearTimeout(failTimeout);
  }, [isloaded, hasFailed]);

  const handleFullscreen = () => {
    if (!resource.allowFullscreen || !frameRef.current) return;

    if (frameRef.current.requestFullscreen) {
      frameRef.current.requestFullscreen();
    }
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
      {!isloaded && !hasFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Loader />
        </div>
      )}

      {!hasFailed ? (
        <>
          <iframe
            src={resource.fileUrl}
            title={title}
            allowFullScreen={resource.allowFullscreen}
            onLoad={handleLoad}
            onError={handleError}
            className="h-full w-full rounded-lg"
          />
          {resource.allowFullscreen && (
            <Button
              variant="primary"
              size="icon"
              className="absolute bottom-2 right-2"
              onClick={handleFullscreen}
            >
              <Maximize2 className="size-5 text-white" />
            </Button>
          )}
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center text-center text-sm text-gray-600">
          <p className="mb-2">⚠️ {t("studentLessonView.other.contentCantBeEmbedded")}</p>
          <a
            href={resource.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {t("studentLessonView.other.openInNewTab")}
          </a>
        </div>
      )}
    </div>
  );
};
