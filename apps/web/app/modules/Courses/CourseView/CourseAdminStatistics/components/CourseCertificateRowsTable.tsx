import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseCertificateRows } from "~/api/queries/useCourseCertificateRows";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

import { getCourseCertificateColumns } from "./CourseCertificateRowsTable.columns";

import type { CourseCertificateRow } from "./CourseCertificateRowsTable.columns";

type CourseCertificateRowsTableProps = {
  courseId: string;
  search?: string;
};

export function CourseCertificateRowsTable({ courseId, search }: CourseCertificateRowsTableProps) {
  const { t } = useTranslation();

  const language = useLanguageStore((state) => state.language);

  const { data: rows = [], isFetching } = useCourseCertificateRows(courseId, language, search);
  const { data: globalSettings } = useGlobalSettings();
  const [preview, setPreview] = useState<CourseCertificateRow | null>(null);

  const columns = useMemo(() => getCourseCertificateColumns(t, setPreview), [t]);

  const table = useReactTable({
    getRowId: (row) => row.learnerEmail,
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-neutral-200",
          isFetching && "shimmer-45",
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="body-base-md bg-neutral-50 text-neutral-900"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-neutral-100">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!table.getRowModel().rows.length && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-neutral-500">
                  {t("adminCourseView.statistics.certificates.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent
          className="max-w-6xl overflow-hidden p-0"
          noCloseButton
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {t("adminCourseView.statistics.certificates.preview")}
          </DialogTitle>
          {preview && (
            <div className="relative">
              <CertificatePreview
                studentName={preview.learnerName}
                courseName={preview.courseTitle}
                completionDate={preview.issuedAt ?? undefined}
                expiryDate={preview.expiresAt ?? undefined}
                certificateSignatureUrl={preview.certificateSignatureUrl}
                certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
                platformLogo={globalSettings?.platformLogoS3Key}
                initialColor={preview.certificateFontColor}
                showDownloadButton={false}
                showShareButton={false}
                onClose={() => setPreview(null)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
