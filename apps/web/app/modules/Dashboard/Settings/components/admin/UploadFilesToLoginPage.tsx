import { LOGIN_PAGE_DOCUMENTS_FILE_TYPES, MAX_LOGIN_PAGE_DOCUMENTS } from "@repo/shared";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import useLoginPageFiles from "~/api/queries/useLoginPageFiles";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

import { UploadFilesToLoginPageDeleteDialog } from "./UploadFilesToLoginPageDeleteDialog";
import { UploadFilesToLoginPageDialog } from "./UploadFilesToLoginPageDialog";
import { UploadFilesToLoginPageItem } from "./UploadFilesToLoginPageItem";
import { UploadFilesToLoginPagePreviewDialog } from "./UploadFilesToLoginPagePreviewDialog";

import type { GetLoginPageFilesResponse } from "~/api/generated-api";

type LoginPageResource = GetLoginPageFilesResponse["resources"][number];

export const UploadFilesToLoginPage = () => {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<LoginPageResource | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewResource, setPreviewResource] = useState<LoginPageResource | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: loginResources } = useLoginPageFiles();
  const resources = loginResources?.resources ?? [];

  const handleAddClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsDialogOpen(true);
    event.target.value = "";
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedFile(null);
  };

  const handleDeleteClick = (resource: LoginPageResource) => {
    setSelectedResource(resource);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedResource(null);
  };

  const handlePreviewClick = (resource: LoginPageResource) => {
    setPreviewResource(resource);
    setIsPreviewDialogOpen(true);
  };

  const handleClosePreviewDialog = () => {
    setIsPreviewDialogOpen(false);
    setPreviewResource(null);
  };

  return (
    <Card id="default-course-currency">
      <CardHeader>
        <CardTitle className="h5">{t("loginFilesUpload.header")}</CardTitle>
        <CardDescription className="body-lg-md flex items-center justify-between">
          {t("loginFilesUpload.subHeader", { count: MAX_LOGIN_PAGE_DOCUMENTS })}
          <Badge variant="notStartedFilled" className="text-xs">
            {resources.length}/{MAX_LOGIN_PAGE_DOCUMENTS}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {resources.map((resource) => (
              <UploadFilesToLoginPageItem
                key={resource.id}
                resource={resource}
                onPreview={handlePreviewClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          disabled={resources.length >= MAX_LOGIN_PAGE_DOCUMENTS}
          onClick={handleAddClick}
        >
          {t("loginFilesUpload.addButton")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept={LOGIN_PAGE_DOCUMENTS_FILE_TYPES.join(",")}
          onChange={handleFileChange}
        />
      </CardFooter>
      <UploadFilesToLoginPageDialog
        open={isDialogOpen}
        file={selectedFile}
        onClose={handleCloseDialog}
      />
      <UploadFilesToLoginPageDeleteDialog
        open={isDeleteDialogOpen}
        resourceId={selectedResource?.id ?? null}
        resourceName={selectedResource?.name ?? t("loginFilesUpload.unnamedFile")}
        onClose={handleCloseDeleteDialog}
      />
      <UploadFilesToLoginPagePreviewDialog
        open={isPreviewDialogOpen}
        resourceName={previewResource?.name ?? t("loginFilesUpload.unnamedFile")}
        resourceUrl={previewResource?.resourceUrl ?? ""}
        onClose={handleClosePreviewDialog}
      />
    </Card>
  );
};
