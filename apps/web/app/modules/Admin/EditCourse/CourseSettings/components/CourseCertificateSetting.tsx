import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateHasCertificate } from "~/api/mutations/useUpdateHasCertificate";
import { courseQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { Toggle } from "~/components/ui/toggle";

interface CourseCertificateSettingProps {
  courseId: string;
  hasCertificate: boolean;
}

const CourseCertificateSetting = ({ courseId, hasCertificate }: CourseCertificateSettingProps) => {
  const { t } = useTranslation();
  const [isCertificateEnabled, setIsCertificateEnabled] = useState(hasCertificate);

  const { mutate: updateHasCertificate, isPending: isUpdatingCertificate } =
    useUpdateHasCertificate();

  const handleCertificateToggle = (newValue: boolean) => {
    setIsCertificateEnabled(newValue);

    if (courseId) {
      updateHasCertificate(
        { courseId, data: { hasCertificate: newValue } },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries(courseQueryOptions(courseId));
          },
          onError: (error) => {
            console.error(`Error updating certificate:`, error);
            setIsCertificateEnabled(!newValue);
          },
        },
      );
    }
  };

  return (
    <div className="flex items-center justify-between">
      <h5 className="h5 text-neutral-950">{t("adminCourseView.settings.editHeader")}</h5>
      <Toggle
        pressed={isCertificateEnabled}
        onPressedChange={handleCertificateToggle}
        disabled={isUpdatingCertificate}
        aria-label={t("adminCourseView.settings.other.enableCertificate")}
      >
        {isCertificateEnabled
          ? t("adminCourseView.settings.button.includesCertificate")
          : t("adminCourseView.settings.button.doesNotIncludeCertificate")}
        {isUpdatingCertificate && t("common.button.saving")}
      </Toggle>
    </div>
  );
};

export default CourseCertificateSetting;
