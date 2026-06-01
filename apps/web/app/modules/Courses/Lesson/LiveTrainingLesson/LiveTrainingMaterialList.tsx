import { Download, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getReadableFileTypeLabel } from "~/utils/fileDisplay";

import type { LiveTrainingMaterial } from "./LiveTrainingLesson.types";

type LiveTrainingMaterialListProps = {
  materials: LiveTrainingMaterial[];
  emptyMessage: string;
  materialCardTestId: (resourceId: string) => string;
  onOpen: (material: LiveTrainingMaterial) => void;
};

export function LiveTrainingMaterialList({
  materials,
  emptyMessage,
  materialCardTestId,
  onOpen,
}: LiveTrainingMaterialListProps) {
  const { t } = useTranslation();

  if (materials.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
      {materials.map((material) => (
        <div
          key={material.resourceId}
          data-testid={materialCardTestId(material.resourceId)}
          className="flex min-w-0 flex-col justify-between rounded-md border border-neutral-200 bg-white p-3 shadow-sm"
        >
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-600">
                <FileText className="size-4" />
              </span>
              <Badge variant="outline" fontWeight="normal" className="rounded px-2 py-0.5 text-xs">
                {getReadableFileTypeLabel(material.contentType)}
              </Badge>
            </div>
            <p className="truncate text-sm font-medium text-neutral-950" title={material.title}>
              {material.title}
            </p>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded px-2 text-xs text-neutral-600 hover:text-primary-700"
              aria-label={t("liveTrainingView.files.download")}
              onClick={() => onOpen(material)}
            >
              <Download className="size-3.5" />
              {t("liveTrainingView.files.download")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
