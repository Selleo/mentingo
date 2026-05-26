import { ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES, LEARNING_PATH_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { ContentEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { LearningPathLanguageSelector } from "~/modules/Admin/LearningPaths/LearningPathLanguageSelector";

import type { LearningPathEditorFormValues } from "../types";
import type { UseFormReturn } from "react-hook-form";
import type { LocalizedResourceLanguageSelectorProps } from "~/components/LanguageSelector/types";

type LearningPathEditorDetailsSectionProps = {
  form: UseFormReturn<LearningPathEditorFormValues>;
  isCreateMode: boolean;
  coursesCount: number;
  learningPathId?: string;
  languageSelectorProps: LocalizedResourceLanguageSelectorProps;
  thumbnailUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageUpload: (file: File) => void;
  onRemoveThumbnail: () => void;
  certificateSignatureUrl: string | null;
  certificateSignatureFileInputRef: React.RefObject<HTMLInputElement>;
  onCertificateSignatureUpload: (file: File) => void;
  onRemoveCertificateSignature: () => void;
  canEdit: boolean;
};

const SettingsRow = ({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) => (
  <div className="flex min-h-[76px] items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
    <div>
      <p className="body-sm-md text-neutral-950">{label}</p>
      <p className="details-md mt-1 text-neutral-600">{description}</p>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

const SpacedSeparator = () => (
  <div className="py-6">
    <hr className="border-neutral-200" />
  </div>
);

const CompactSeparator = () => (
  <div className="py-2">
    <hr className="border-neutral-200" />
  </div>
);

export function LearningPathEditorDetailsSection({
  form,
  isCreateMode,
  coursesCount,
  learningPathId,
  languageSelectorProps,
  thumbnailUrl,
  fileInputRef,
  onImageUpload,
  onRemoveThumbnail,
  certificateSignatureUrl,
  certificateSignatureFileInputRef,
  onCertificateSignatureUpload,
  onRemoveCertificateSignature,
  canEdit,
}: LearningPathEditorDetailsSectionProps) {
  const { t } = useTranslation();
  const includesCertificate = form.watch("includesCertificate");

  return (
    <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-950">
            {t("adminLearningPathsView.editor.details")}
          </h2>
          <p className="details-md mt-1 text-neutral-600">
            {isCreateMode
              ? t("adminLearningPathsView.editor.createSummary")
              : t("adminLearningPathsView.editor.editSummary", {
                  coursesCount,
                })}
          </p>
        </div>
        <LearningPathLanguageSelector
          formKey={languageSelectorProps.formKey}
          learningPathId={learningPathId}
          language={languageSelectorProps.value}
          availableLocales={languageSelectorProps.availableLocales}
          baseLanguage={languageSelectorProps.baseLanguage ?? undefined}
          isCreateMode={isCreateMode}
          onChange={languageSelectorProps.onChange}
          canCreateLanguage={canEdit}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.95fr)] xl:items-start">
        <div className="space-y-6">
          <div>
            <h3 className="body-base-md text-neutral-950">
              {t("adminLearningPathsView.detailsContent.title")}
            </h3>
            <p className="details-md mt-1 text-neutral-600">
              {t("adminLearningPathsView.detailsContent.description")}
            </p>
          </div>

          <div className="grid gap-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <Label>{t("adminLearningPathsView.form.title")}</Label>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!canEdit}
                      placeholder={t("adminLearningPathsView.form.titlePlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <Label>{t("adminLearningPathsView.form.description")}</Label>
                  <FormControl>
                    <ContentEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder={t("adminLearningPathsView.form.descriptionPlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col">
          <div className="grid gap-6">
            <div>
              <h3 className="body-base-md text-neutral-950">
                {t("adminLearningPathsView.detailsImage.title")}
              </h3>
              <p className="details-md mt-1 text-neutral-600">
                {t("adminLearningPathsView.detailsImage.description")}
              </p>
            </div>

            <FormField
              control={form.control}
              name="thumbnailReference"
              render={({ field }) => (
                <FormItem>
                  <ImageUploadInput
                    field={{ value: field.value ?? "" }}
                    handleImageUpload={onImageUpload}
                    isUploading={false}
                    disabled={!canEdit}
                    imageUrl={thumbnailUrl}
                    fileInputRef={fileInputRef}
                    variant="video"
                    detailsText={t("adminLearningPathsView.form.imageHint")}
                    inputId="learning-path-thumbnail"
                  />
                  {field.value && canEdit && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="mt-2 h-auto px-0 py-0 text-error-600"
                      onClick={onRemoveThumbnail}
                    >
                      {t("adminLearningPathsView.buttons.removeImage")}
                    </Button>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <SpacedSeparator />

          <div className="grid gap-6">
            <div>
              <h3 className="body-base-md text-neutral-950">
                {t("adminLearningPathsView.detailsSettings.title")}
              </h3>
              <p className="details-md mt-1 text-neutral-600">
                {t("adminLearningPathsView.detailsSettings.description")}
              </p>
            </div>

            <div className="flex flex-col">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <SettingsRow
                      label={t("adminLearningPathsView.form.status")}
                      description={t("adminLearningPathsView.form.statusDescription")}
                      control={
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!canEdit}
                        >
                          <FormControl>
                            <SelectTrigger className="min-w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(LEARNING_PATH_STATUSES).map((status) => (
                              <SelectItem key={status} value={status}>
                                {t(`learningPathsView.status.${status}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      }
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CompactSeparator />
              <FormField
                control={form.control}
                name="sequenceEnabled"
                render={({ field }) => (
                  <FormItem>
                    <SettingsRow
                      label={t("adminLearningPathsView.form.sequenceEnabled")}
                      description={t("adminLearningPathsView.form.sequenceEnabledDescription")}
                      control={
                        <FormControl>
                          <Switch
                            checked={field.value}
                            disabled={!canEdit}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      }
                    />
                  </FormItem>
                )}
              />
              <CompactSeparator />
              <FormField
                control={form.control}
                name="includesCertificate"
                render={({ field }) => (
                  <FormItem>
                    <SettingsRow
                      label={t("adminLearningPathsView.form.includesCertificate")}
                      description={t("adminLearningPathsView.form.includesCertificateDescription")}
                      control={
                        <FormControl>
                          <Switch
                            checked={field.value}
                            disabled={!canEdit}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      }
                    />
                  </FormItem>
                )}
              />
              {includesCertificate && (
                <>
                  <CompactSeparator />
                  <div
                    className={`rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition-opacity ${
                      canEdit ? "opacity-100" : "opacity-50"
                    }`}
                    aria-disabled={!canEdit}
                  >
                    <div className="mb-3">
                      <p className="body-sm-md text-neutral-950">
                        {t("adminLearningPathsView.form.certificateSignature")}
                      </p>
                      <p className="details-md mt-1 text-neutral-600">
                        {t("adminLearningPathsView.form.certificateSignatureDescription")}
                      </p>
                    </div>
                    <ImageUploadInput
                      field={{ value: certificateSignatureUrl ?? undefined }}
                      handleImageUpload={onCertificateSignatureUpload}
                      isUploading={false}
                      disabled={!canEdit}
                      imageUrl={certificateSignatureUrl}
                      fileInputRef={certificateSignatureFileInputRef}
                      variant="video"
                      accept={[...ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES].join(",")}
                      imageFit="contain"
                      detailsText={t(
                        "adminCourseView.settings.other.certificateSignatureRequirements",
                      )}
                      inputId="learning-path-certificate-signature"
                    />
                    {certificateSignatureUrl && canEdit && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="mt-2 h-auto px-0 py-0 text-error-600"
                        onClick={onRemoveCertificateSignature}
                      >
                        {t("adminCourseView.settings.button.removeCertificateSignature")}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
