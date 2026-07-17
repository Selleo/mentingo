import { ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES } from "@repo/shared";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateCourseSettings } from "~/api/mutations/useUpdateCourseSettings";
import { useUpdateHasCertificate } from "~/api/mutations/useUpdateHasCertificate";
import { useCurrentUser } from "~/api/queries";
import { useCourseSettings } from "~/api/queries/useCourseSettings";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { CertificateValidityImpactDialog } from "~/modules/Admin/EditCourse/CourseSettings/components/CertificateValidityImpactDialog";
import { CertificateValiditySection } from "~/modules/Admin/EditCourse/CourseSettings/components/CertificateValiditySection";
import { useCertificateValiditySettings } from "~/modules/Admin/EditCourse/CourseSettings/components/useCertificateValiditySettings";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

import { COURSE_SETTINGS_HANDLES } from "../../../../../e2e/data/courses/handles";
import { useCourseAccessProvider } from "../../context/CourseAccessProvider";

type CertificateModalProps = {
  courseTitle: string;
  hasCertificate: boolean;
  onClose: () => void;
};

export default function CertificateModal({
  courseTitle,
  hasCertificate,
  onClose,
}: CertificateModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const currentUserName = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ");
  const { course } = useCourseAccessProvider();
  const [isCertificateEnabled, setIsCertificateEnabled] = useState(hasCertificate);
  const [certificateColor, setCertificateColor] = useState("#3f58b6");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCertificateColorPickerOpen, setIsCertificateColorPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedColorRef = useRef<string | null>(null);
  const pendingColorRef = useRef<string | null>(null);
  const acceptedSignatureTypes = [...ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES];
  const { data: settings, isLoading: isLoadingSettings } = useCourseSettings({
    courseId: course.id,
  });
  const { data: globalSettings } = useGlobalSettings();
  const {
    mutate: updateCourseSettings,
    isPending: isUpdatingCourseSettings,
    variables: updateCourseSettingsVariables,
  } = useUpdateCourseSettings();
  const { mutate: updateHasCertificate, isPending: isUpdatingCertificate } =
    useUpdateHasCertificate();
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
    courseId: course.id,
    certificateValidity: settings?.certificateValidity,
  });

  const isCertificateControlsDisabled = !isCertificateEnabled || isUpdatingCertificate;
  const isSignatureUploading =
    isUpdatingCourseSettings && Boolean(updateCourseSettingsVariables?.data.certificateSignature);
  const isSignatureInputBusy = isLoadingSettings || isUpdatingCourseSettings;
  const previewCompletionDate = useMemo(() => {
    return new Date().toLocaleDateString("en-GB").replaceAll("/", ".");
  }, []);

  useEffect(() => {
    const savedColor = settings?.certificateFontColor ?? null;

    lastSavedColorRef.current = savedColor;
    setCertificateColor(savedColor ?? "#3f58b6");
  }, [settings?.certificateFontColor]);

  useEffect(() => {
    setIsCertificateEnabled(hasCertificate);
  }, [hasCertificate]);

  const handleCertificateColorChange = (nextColor: string) => {
    const normalizedColor = nextColor.toLowerCase();

    setCertificateColor(normalizedColor);
    pendingColorRef.current =
      lastSavedColorRef.current?.toLowerCase() === normalizedColor ? null : normalizedColor;
  };

  const handleColorPickerOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsCertificateColorPickerOpen(isOpen);

      if (isOpen || !pendingColorRef.current) return;

      const colorToSave = pendingColorRef.current;
      const previousColor = lastSavedColorRef.current ?? "#3f58b6";
      pendingColorRef.current = null;
      updateCourseSettings(
        {
          courseId: course.id,
          data: { certificateFontColor: colorToSave },
        },
        {
          onSuccess: () => {
            lastSavedColorRef.current = colorToSave;
          },
          onError: () => {
            setCertificateColor(previousColor);
          },
        },
      );
    },
    [course.id, updateCourseSettings],
  );

  const handleCertificateToggle = (enabled: boolean) => {
    const previousValue = isCertificateEnabled;

    setIsCertificateEnabled(enabled);
    updateHasCertificate(
      {
        courseId: course.id,
        data: { hasCertificate: enabled },
      },
      {
        onError: () => {
          setIsCertificateEnabled(previousValue);
        },
      },
    );
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
      courseId: course.id,
      data: {
        certificateSignature: file,
      },
    });
  };

  const handleSignatureRemove = () => {
    updateCourseSettings({
      courseId: course.id,
      data: {
        removeCertificateSignature: true,
      },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !isUpdatingCertificate) onClose();
        }}
      >
        <DialogContent
          className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl border-0 p-0 shadow-2xl"
          noCloseButton
          aria-describedby={undefined}
        >
          <div className="space-y-6 p-4 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
                {t("modernCourseView.certificate.title")}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("modernCourseView.certificate.close")}
                disabled={isUpdatingCertificate}
                onClick={onClose}
              >
                <X className="size-5 text-neutral-700" />
              </Button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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
                className="shrink-0 self-start sm:ml-auto"
                disabled={isCertificateControlsDisabled}
                onClick={() => setIsPreviewOpen(true)}
              >
                <Icon name="Eye" className="mr-2 size-4" />
                {t("adminCourseView.settings.other.certificatePreviewButton")}
              </Button>
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

            <div
              className={cn(
                "w-full space-y-2 transition-opacity",
                isCertificateControlsDisabled ? "opacity-50" : "opacity-100",
              )}
              aria-disabled={isCertificateControlsDisabled}
            >
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  {t("modernCourseView.certificate.uploadSignature")}
                </p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {t("modernCourseView.certificate.uploadSignatureHint")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-full max-w-xl flex-none">
                  <ImageUploadInput
                    field={{ value: settings?.certificateSignatureUrl ?? undefined }}
                    handleImageUpload={handleSignatureUpload}
                    isUploading={isSignatureInputBusy}
                    disabled={isCertificateControlsDisabled}
                    imageUrl={settings?.certificateSignatureUrl}
                    fileInputRef={fileInputRef}
                    variant="video"
                    accept={acceptedSignatureTypes.join(",")}
                    imageFit="contain"
                    detailsText={t(
                      "adminCourseView.settings.other.certificateSignatureRequirements",
                    )}
                  />
                  {isSignatureUploading && (
                    <p className="mt-2 text-xs font-medium text-neutral-500">
                      {t("common.other.uploadingImage")}
                    </p>
                  )}
                </div>
                {settings?.certificateSignatureUrl && (
                  <Button
                    type="button"
                    onClick={handleSignatureRemove}
                    variant="destructive"
                    size="sm"
                    className="shrink-0"
                    disabled={isCertificateControlsDisabled || isUpdatingCourseSettings}
                  >
                    <Icon name="TrashIcon" className="mr-2 size-4" />
                    {t("adminCourseView.settings.button.removeCertificateSignature")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="w-auto max-w-[calc(100vw-2rem)] overflow-visible p-0"
          noCloseButton
          aria-describedby={undefined}
          onInteractOutside={(event) => {
            if (isCertificateColorPickerOpen) event.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">
            {t("adminCourseView.settings.other.certificatePreviewButton")}
          </DialogTitle>
          <CertificatePreview
            studentName={
              currentUserName || t("adminCourseView.settings.other.certificatePreviewStudentName")
            }
            courseName={
              courseTitle || t("adminCourseView.settings.other.certificatePreviewCourseName")
            }
            completionDate={previewCompletionDate}
            platformLogo={globalSettings?.platformLogoS3Key}
            certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
            certificateSignatureUrl={settings?.certificateSignatureUrl}
            showColorPicker
            showDownloadButton={false}
            initialColor={certificateColor}
            onColorChange={handleCertificateColorChange}
            onColorPickerOpenChange={handleColorPickerOpenChange}
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
    </>
  );
}
