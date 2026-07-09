import { Check, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

type CertificateModalProps = {
  certificateColor: string;
  certificateEnabledDraft: boolean;
  courseTitle: string;
  isSaving: boolean;
  onCertificateColorChange: (color: string) => void;
  onClose: () => void;
  onSave: () => void;
  onToggleCertificate: () => void;
};

export default function CertificateModal({
  certificateColor,
  certificateEnabledDraft,
  courseTitle,
  isSaving,
  onCertificateColorChange,
  onClose,
  onSave,
  onToggleCertificate,
}: CertificateModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("modernCourseView.certificate.close")}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl md:p-6">
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <h3 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
            {t("modernCourseView.certificate.title")}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-[#676767] md:h-6 md:w-6" />
          </button>
        </div>

        <div className="mb-6 rounded-xl border-4 border-[#e5e5e5] bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
          <div className="text-center">
            <h2
              className="mb-4 font-gothic text-2xl font-bold md:text-4xl"
              style={{ color: certificateColor }}
            >
              {t("modernCourseView.certificate.previewTitle")}
            </h2>
            <p className="mb-4 text-base text-[#676767] md:mb-6 md:text-lg">
              {t("modernCourseView.certificate.certifies")}
            </p>
            <p className="mb-4 text-xl font-bold text-[#363636] md:mb-6 md:text-3xl">Ellis Admin</p>
            <p className="mb-2 text-base text-[#676767] md:text-lg">
              {t("modernCourseView.certificate.completed")}
            </p>
            <p className="mb-6 text-lg font-bold text-[#363636] md:mb-8 md:text-2xl">
              {courseTitle}
            </p>
            <div className="border-t-2 border-[#e5e5e5] pt-6">
              <p className="text-sm text-[#676767]">
                {t("modernCourseView.certificate.signaturePlaceholder")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-[#f9fafb] p-4">
            <div>
              <p className="font-semibold text-[#363636]">
                {t("modernCourseView.certificate.enable")}
              </p>
              <p className="text-sm text-[#676767]">
                {t("modernCourseView.certificate.enableDescription")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={certificateEnabledDraft}
              onClick={onToggleCertificate}
              className={`relative h-8 w-14 rounded-full transition-colors ${
                certificateEnabledDraft ? "bg-[#26b183]" : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform ${
                  certificateEnabledDraft ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          {certificateEnabledDraft && (
            <>
              <div>
                <label
                  htmlFor="certificate-font-color"
                  className="mb-2 block text-sm font-semibold text-[#363636]"
                >
                  {t("modernCourseView.certificate.fontColor")}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="certificate-font-color"
                    type="color"
                    value={certificateColor}
                    onChange={(event) => onCertificateColorChange(event.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-[#e5e5e5]"
                  />
                  <input
                    type="text"
                    value={certificateColor}
                    onChange={(event) => onCertificateColorChange(event.target.value)}
                    className="flex-1 rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 block text-sm font-semibold text-[#363636]">
                  {t("modernCourseView.certificate.uploadSignature")}
                </p>
                <div className="cursor-pointer rounded-xl border-2 border-dashed border-[#e5e5e5] p-6 text-center transition-colors hover:border-[#3f58b6]">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-[#676767]" />
                  <p className="text-sm text-[#676767]">
                    {t("modernCourseView.certificate.uploadSignatureHint")}
                  </p>
                  <p className="mt-1 text-xs text-[#676767]">
                    {t("modernCourseView.certificate.signatureLimit")}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="order-2 w-full rounded-lg bg-gray-200 px-6 py-2 font-semibold text-[#363636] transition-colors hover:bg-gray-300 sm:order-1 sm:w-auto"
          >
            {t("modernCourseView.common.cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="order-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3f58b6] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#324a95] sm:order-2 sm:w-auto"
          >
            <Check className="h-4 w-4" />
            {t("modernCourseView.certificate.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
