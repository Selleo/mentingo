import { ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES, LEARNING_PATH_STATUSES } from "@repo/shared";
import { Eye, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useToast } from "~/components/ui/use-toast";
import { LearningPathExportsSection } from "~/modules/LearningPaths/components/LearningPathExportsSection";
import { CERTIFICATE_KIND } from "~/modules/Profile/Certificates/certificateKind";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

import type { GetLearningPathsResponse, UpdateLearningPathBody } from "~/api/generated-api";

type LearningPathListItem = GetLearningPathsResponse["data"][number];

type LearningPathSettingsDrawerProps = {
  canEdit: boolean;
  canExport?: boolean;
  learningPathId: string;
  title: string;
  status: LearningPathListItem["status"];
  sequenceEnabled: boolean;
  includesCertificate: boolean;
  certificateSignatureUrl?: string | null;
  certificateFontColor?: string | null;
  isPending: boolean;
  onStatusChange: (status: UpdateLearningPathBody["status"]) => void;
  onSequenceEnabledChange: (sequenceEnabled: boolean) => void;
  onCertificateChange: (includesCertificate: boolean) => void;
  onCertificateSignatureUpload: (file: File) => void;
  onRemoveCertificateSignature: () => void;
  onCertificateFontColorChange: (color: string) => void;
};

export function LearningPathSettingsDrawer({
  canEdit,
  canExport = false,
  learningPathId,
  title,
  status,
  sequenceEnabled,
  includesCertificate,
  certificateSignatureUrl,
  certificateFontColor,
  isPending,
  onStatusChange,
  onSequenceEnabledChange,
  onCertificateChange,
  onCertificateSignatureUpload,
  onRemoveCertificateSignature,
  onCertificateFontColorChange,
}: LearningPathSettingsDrawerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const colorSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedColorRef = useRef<string | null>(certificateFontColor ?? null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const acceptedSignatureTypes = [...ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES];
  const { data: globalSettings } = useGlobalSettings();

  useEffect(() => {
    lastSavedColorRef.current = certificateFontColor ?? null;
  }, [certificateFontColor]);

  useEffect(() => {
    return () => {
      if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);
    };
  }, []);

  const previewCompletionDate = useMemo(() => {
    return new Date().toLocaleDateString("en-GB").replaceAll("/", ".");
  }, []);

  const handleSignatureUpload = (file: File) => {
    if (!(acceptedSignatureTypes as readonly string[]).includes(file.type)) {
      toast({
        variant: "destructive",
        description: t("adminCourseView.toast.certificateUpdateError"),
      });
      return;
    }

    onCertificateSignatureUpload(file);
  };

  const handleRemoveSignature = () => {
    onRemoveCertificateSignature();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCertificateColorChange = (nextColor: string) => {
    const normalizedColor = nextColor.toLowerCase();
    if (lastSavedColorRef.current?.toLowerCase() === normalizedColor) return;

    if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);

    colorSaveTimeout.current = setTimeout(() => {
      onCertificateFontColorChange(normalizedColor);
      lastSavedColorRef.current = normalizedColor;
    }, 400);
  };

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={isPending}
          aria-label={t("adminLearningPathsView.detailsSettings.title")}
        >
          <Settings className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bottom-0 left-auto right-0 top-0 mt-0 h-full w-full max-w-[520px] overflow-hidden rounded-none border-l border-primary-100 bg-white p-0 shadow-xl [&>div:first-child]:hidden">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-primary-100 px-6 py-6">
            <div>
              <DrawerTitle className="body-base-md text-primary-950">
                {t("adminLearningPathsView.detailsSettings.title")}
              </DrawerTitle>
              <DrawerDescription className="details-md mt-1 text-neutral-600">
                {t("adminLearningPathsView.detailsSettings.description")}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("common.button.close")}
                className="shrink-0 text-neutral-500 hover:text-neutral-900"
              >
                <X className="size-5" />
              </Button>
            </DrawerClose>
          </div>
          <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-6 py-6">
            {canEdit && (
              <>
                <div className="grid gap-2">
                  <label className="body-sm-md text-neutral-950">
                    {t("adminLearningPathsView.form.status")}
                  </label>
                  <Select
                    value={status}
                    onValueChange={(value) =>
                      onStatusChange(value as UpdateLearningPathBody["status"])
                    }
                  >
                    <SelectTrigger className="body-sm-md h-10 rounded-lg border-primary-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(LEARNING_PATH_STATUSES).map((statusValue) => (
                        <SelectItem key={statusValue} value={statusValue}>
                          {t(`learningPathsView.status.${statusValue}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="details-md text-neutral-600">
                    {t("adminLearningPathsView.form.statusDescription")}
                  </p>
                </div>
                <div className="border-t border-primary-100" />
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="body-sm-md text-neutral-950">
                      {t("adminLearningPathsView.form.sequenceEnabled")}
                    </p>
                    <p className="details-md mt-1 text-neutral-600">
                      {t("adminLearningPathsView.form.sequenceEnabledDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={sequenceEnabled}
                    onCheckedChange={onSequenceEnabledChange}
                    disabled={isPending}
                  />
                </div>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="body-sm-md text-neutral-950">
                      {t("adminLearningPathsView.form.includesCertificate")}
                    </p>
                    <p className="details-md mt-1 text-neutral-600">
                      {t("adminLearningPathsView.form.includesCertificateDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={includesCertificate}
                    onCheckedChange={onCertificateChange}
                    disabled={isPending}
                  />
                </div>
                {includesCertificate && (
                  <>
                    <div className="border-t border-primary-100" />
                    <div className="grid gap-4">
                      <div>
                        <p className="body-sm-md text-neutral-950">
                          {t("adminLearningPathsView.form.certificateSignature")}
                        </p>
                        <p className="details-md mt-1 text-neutral-600">
                          {t("adminLearningPathsView.form.certificateSignatureDescription")}
                        </p>
                      </div>
                      <ImageUploadInput
                        field={{ value: certificateSignatureUrl ?? undefined }}
                        handleImageUpload={handleSignatureUpload}
                        isUploading={isPending}
                        disabled={isPending}
                        imageUrl={certificateSignatureUrl}
                        fileInputRef={fileInputRef}
                        variant="video"
                        accept={acceptedSignatureTypes.join(",")}
                        imageFit="contain"
                        detailsText={t(
                          "adminCourseView.settings.other.certificateSignatureRequirements",
                        )}
                        inputId="learning-path-settings-certificate-signature"
                      />
                      {certificateSignatureUrl && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                          className="w-fit"
                          onClick={handleRemoveSignature}
                        >
                          {t("adminCourseView.settings.button.removeCertificateSignature")}
                        </Button>
                      )}
                    </div>
                    <div className="border-t border-primary-100" />
                    <div className="grid gap-3">
                      <div>
                        <p className="body-sm-md text-neutral-950">
                          {t("adminLearningPathsView.form.certificatePreview")}
                        </p>
                        <p className="details-md mt-1 text-neutral-600">
                          {t("adminLearningPathsView.form.certificatePreviewDescription")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit gap-2"
                        disabled={isPending}
                        onClick={() => setIsPreviewOpen(true)}
                      >
                        <Eye className="size-4" />
                        {t("adminCourseView.settings.other.certificatePreviewButton")}
                      </Button>
                      <p className="details-md text-neutral-600">
                        {t("adminLearningPathsView.form.certificateFontColorDescription")}
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {canExport && (
              <div className="border-t border-primary-100 pt-4">
                <LearningPathExportsSection learningPathId={learningPathId} />
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="w-[95vw] max-w-[1120px] border-none bg-transparent p-0 shadow-none"
          noCloseButton
        >
          <CertificatePreview
            studentName={t("adminCourseView.settings.other.certificatePreviewStudentName")}
            courseName={title || t("learningPathsView.detailsTitle")}
            completionDate={previewCompletionDate}
            platformLogo={globalSettings?.platformLogoS3Key}
            certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
            certificateSignatureUrl={certificateSignatureUrl}
            showColorPicker
            showDownloadButton={false}
            initialColor={certificateFontColor}
            onColorChange={handleCertificateColorChange}
            certificateKind={CERTIFICATE_KIND.LEARNING_PATH}
          />
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}
