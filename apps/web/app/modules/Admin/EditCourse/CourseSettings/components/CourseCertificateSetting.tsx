import { ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES } from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateCourseSettings } from "~/api/mutations/useUpdateCourseSettings";
import { useUpdateHasCertificate } from "~/api/mutations/useUpdateHasCertificate";
import { courseQueryOptions } from "~/api/queries";
import { useCourseSettings } from "~/api/queries/useCourseSettings";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

import { COURSE_SETTINGS_HANDLES } from "../../../../../../e2e/data/courses/handles";

import { CertificateResetSection } from "./CertificateResetSection";
import { CertificateValidityImpactDialog } from "./CertificateValidityImpactDialog";
import { CertificateValiditySection } from "./CertificateValiditySection";
import { useCertificateValiditySettings } from "./useCertificateValiditySettings";

interface CourseCertificateSettingProps {
  courseId: string;
  hasCertificate: boolean;
  courseTitle?: string;
}

const CourseCertificateSetting = ({
  courseId,
  hasCertificate,
  courseTitle,
}: CourseCertificateSettingProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCertificateEnabled, setIsCertificateEnabled] = useState(hasCertificate);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const colorSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedColorRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const acceptedSignatureTypes = [...ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES];

  const { mutate: updateHasCertificate, isPending: isUpdatingCertificate } =
    useUpdateHasCertificate();
  const { data: settings, isLoading: isLoadingSettings } = useCourseSettings({ courseId });
  const { data: globalSettings } = useGlobalSettings();
  const { mutate: updateCourseSettings, isPending: isUpdatingCourseSettings } =
    useUpdateCourseSettings();

  const {
    isValidityEnabled,
    validityType,
    validityValue,
    validityUnit,
    validityDate,
    validityImpact,
    isValidityImpactOpen,
    validityDateError,
    hasValidityChanges,
    isCheckingValidityImpact,
    isUpdatingCourseSettings: isUpdatingCertificateValidity,
    setIsValidityEnabled,
    setValidityType,
    setValidityValue,
    setValidityUnit,
    setValidityDate,
    setIsValidityImpactOpen,
    saveValidity,
    handleValiditySave,
  } = useCertificateValiditySettings({
    courseId,
    certificateValidity: settings?.certificateValidity,
  });

  useEffect(() => {
    setIsCertificateEnabled(hasCertificate);
  }, [hasCertificate]);

  useEffect(() => {
    lastSavedColorRef.current = settings?.certificateFontColor ?? null;
  }, [settings?.certificateFontColor]);

  useEffect(() => {
    return () => {
      if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);
    };
  }, []);

  const invalidateCourseQuery = useCallback(async () => {
    await queryClient.invalidateQueries(courseQueryOptions(courseId));
  }, [courseId]);

  const handleCertificateToggle = (newValue: boolean) => {
    setIsCertificateEnabled(newValue);

    if (courseId) {
      updateHasCertificate(
        { courseId, data: { hasCertificate: newValue } },
        {
          onSuccess: invalidateCourseQuery,
          onError: (error) => {
            console.error(`Error updating certificate:`, error);
            setIsCertificateEnabled(!newValue);
          },
        },
      );
    }
  };

  const handleSignatureUpload = (file: File) => {
    if (!(acceptedSignatureTypes as readonly string[]).includes(file.type)) {
      toast({
        variant: "destructive",
        description: t("adminCourseView.toast.certificateUpdateError"),
      });
      return;
    }

    updateCourseSettings({
      courseId,
      data: {
        certificateSignature: file,
      },
    });
  };

  const handleSignatureRemove = () => {
    updateCourseSettings({
      courseId,
      data: {
        removeCertificateSignature: true,
      },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isUploading = isLoadingSettings || isUpdatingCourseSettings;
  const isCertificateControlsDisabled = !isCertificateEnabled || isUpdatingCertificate;
  const previewCompletionDate = useMemo(() => {
    return new Date().toLocaleDateString("en-GB").replaceAll("/", ".");
  }, []);

  const clearColorSaveTimeout = () => {
    if (colorSaveTimeout.current) clearTimeout(colorSaveTimeout.current);
  };

  const saveCertificateColor = (normalizedColor: string) => {
    updateCourseSettings({
      courseId,
      data: { certificateFontColor: normalizedColor },
      showToast: false,
    });

    lastSavedColorRef.current = normalizedColor;
  };

  const handleCertificateColorChange = (nextColor: string) => {
    const normalizedColor = nextColor.toLowerCase();
    if (lastSavedColorRef.current?.toLowerCase() === normalizedColor) return;

    clearColorSaveTimeout();

    colorSaveTimeout.current = setTimeout(() => {
      saveCertificateColor(normalizedColor);
    }, 400);
  };

  return (
    <div className="rounded-xl border border-neutral-300 p-5">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <Switch
                data-testid={COURSE_SETTINGS_HANDLES.CERTIFICATE_SWITCH}
                checked={isCertificateEnabled}
                onCheckedChange={handleCertificateToggle}
                disabled={isUpdatingCertificate}
                aria-label={t("adminCourseView.settings.other.enableCertificate")}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <p className="text-base font-semibold text-neutral-950">
                  {t("adminCourseView.settings.other.enableCertificate")}
                </p>
                <p className="text-sm text-neutral-700">
                  {t("adminCourseView.settings.other.enableCertificateDescription")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={isCertificateControlsDisabled}
              onClick={() => setIsPreviewOpen(true)}
            >
              <Icon name="Eye" className="mr-2 size-4" />
              {t("adminCourseView.settings.other.certificatePreviewButton")}
            </Button>
          </div>

          <div
            className={cn(
              "w-full max-w-xl space-y-2 transition-opacity",
              isCertificateControlsDisabled ? "opacity-50" : "opacity-100",
            )}
            aria-disabled={isCertificateControlsDisabled}
          >
            <ImageUploadInput
              field={{ value: settings?.certificateSignatureUrl ?? undefined }}
              handleImageUpload={handleSignatureUpload}
              isUploading={isUploading}
              disabled={isCertificateControlsDisabled}
              imageUrl={settings?.certificateSignatureUrl}
              fileInputRef={fileInputRef}
              variant="video"
              accept={acceptedSignatureTypes.join(",")}
              imageFit="contain"
              detailsText={t("adminCourseView.settings.other.certificateSignatureRequirements")}
            />
            {isUploading && (
              <p className="text-xs font-medium text-neutral-500">
                {t("common.other.uploadingImage")}
              </p>
            )}
            {settings?.certificateSignatureUrl && (
              <Button
                type="button"
                onClick={handleSignatureRemove}
                variant="destructive"
                size="sm"
                disabled={isCertificateControlsDisabled}
              >
                <Icon name="TrashIcon" className="mr-2" />
                {t("adminCourseView.settings.button.removeCertificateSignature")}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <CertificateValiditySection
          disabled={isCertificateControlsDisabled}
          isValidityEnabled={isValidityEnabled}
          hasValidityChanges={hasValidityChanges}
          isCheckingValidityImpact={isCheckingValidityImpact}
          isUpdatingCourseSettings={isUpdatingCertificateValidity}
          validityType={validityType}
          validityValue={validityValue}
          validityUnit={validityUnit}
          validityDate={validityDate}
          validityDateError={validityDateError}
          onValidityEnabledChange={setIsValidityEnabled}
          onValidityTypeChange={setValidityType}
          onValidityValueChange={setValidityValue}
          onValidityUnitChange={setValidityUnit}
          onValidityDateChange={setValidityDate}
          onSave={handleValiditySave}
        />

        <Separator />

        <CertificateResetSection courseId={courseId} disabled={isCertificateControlsDisabled} />
      </div>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="w-[95vw] max-w-[1120px] border-none bg-transparent p-0 shadow-none"
          noCloseButton
        >
          <CertificatePreview
            studentName={t("adminCourseView.settings.other.certificatePreviewStudentName")}
            courseName={
              courseTitle || t("adminCourseView.settings.other.certificatePreviewCourseName")
            }
            completionDate={previewCompletionDate}
            platformLogo={globalSettings?.platformLogoS3Key}
            certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
            certificateSignatureUrl={settings?.certificateSignatureUrl}
            showColorPicker
            showDownloadButton={false}
            initialColor={settings?.certificateFontColor}
            onColorChange={handleCertificateColorChange}
          />
        </DialogContent>
      </Dialog>
      <CertificateValidityImpactDialog
        open={isValidityImpactOpen}
        impact={validityImpact}
        isEnablingValidity={!settings?.certificateValidity && isValidityEnabled}
        onOpenChange={setIsValidityImpactOpen}
        onFutureOnly={() => saveValidity(false)}
        onApplyToExisting={() => saveValidity(true)}
      />
    </div>
  );
};

export default CourseCertificateSetting;
