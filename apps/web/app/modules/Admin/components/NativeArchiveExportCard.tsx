import { FolderUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

import { NativeArchiveExportButton } from "./NativeArchiveExportButton";

import type { NativeArchiveExportRequest } from "~/api/mutations/admin/nativeArchive.types";

type NativeArchiveExportCardProps = NativeArchiveExportRequest;

export function NativeArchiveExportCard({ kind, id }: NativeArchiveExportCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-neutral-200 shadow-sm">
      <CardHeader className="px-6 pb-4 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-900">
            <FolderUp className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-semibold text-neutral-950">
              {t("nativeArchive.exportTitle")}
            </CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-neutral-700">
              {t(`nativeArchive.exportDescription.${kind}`)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex justify-end px-6 pb-6">
        <NativeArchiveExportButton kind={kind} id={id} />
      </CardContent>
    </Card>
  );
}
