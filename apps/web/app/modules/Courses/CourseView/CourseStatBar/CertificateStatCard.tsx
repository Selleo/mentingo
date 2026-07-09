import { Award } from "lucide-react";
import { useTranslation } from "react-i18next";

type CertificateStatCardProps = {
  hasCertificate: boolean;
  isAdminExperience: boolean;
  onOpen: () => void;
};

const getCertificateStatusLabel = (
  isAdminExperience: boolean,
  hasCertificate: boolean,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  if (!isAdminExperience) return t("modernCourseView.stats.uponCompletion");
  return hasCertificate
    ? t("modernCourseView.common.enabled")
    : t("modernCourseView.common.disabled");
};

export default function CertificateStatCard({
  hasCertificate,
  isAdminExperience,
  onOpen,
}: CertificateStatCardProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={!isAdminExperience}
      onClick={() => {
        if (isAdminExperience) {
          onOpen();
        }
      }}
      className={`rounded-2xl border-l-4 border-[#26b183] bg-white p-4 text-left shadow-lg ${
        isAdminExperience
          ? "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:outline hover:outline-2 hover:outline-dashed hover:outline-[#26b183]/40"
          : ""
      } ${isAdminExperience && !hasCertificate ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-50">
          <Award className="h-6 w-6 text-[#26b183]" />
        </div>
        <div className="flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-[#676767]">
            {t("modernCourseView.stats.certificate")}
          </p>
          <p className="text-xl font-bold text-[#363636]">
            {getCertificateStatusLabel(isAdminExperience, hasCertificate, t)}
          </p>
        </div>
      </div>
    </button>
  );
}
