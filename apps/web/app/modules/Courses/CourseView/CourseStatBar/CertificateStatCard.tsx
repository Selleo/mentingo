import { Award } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

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
      className={cn("rounded-2xl border-l-4 border-success-500 bg-white p-4 text-left shadow-lg", {
        "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:outline hover:outline-2 hover:outline-dashed hover:outline-success-500/40":
          isAdminExperience,
        "opacity-50": isAdminExperience && !hasCertificate,
      })}
    >
      <div className="flex items-start gap-4">
        <div className="mt-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-success-50">
          <Award className="h-6 w-6 text-success-500" />
        </div>
        <div className="flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-neutral-800">
            {t("modernCourseView.stats.certificate")}
          </p>
          <p className="text-xl font-bold text-neutral-950">
            {getCertificateStatusLabel(isAdminExperience, hasCertificate, t)}
          </p>
        </div>
      </div>
    </button>
  );
}
