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
      className={cn("relative overflow-hidden rounded-2xl bg-white p-4 text-left shadow-lg", {
        "cursor-pointer transition-all hover:shadow-xl hover:outline hover:outline-2 hover:outline-dashed hover:outline-success-500/40":
          isAdminExperience,
        "opacity-50": isAdminExperience && !hasCertificate,
      })}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-success-500" aria-hidden="true" />
      <div className="flex items-start gap-4">
        <div className="mt-3 flex size-12 flex-shrink-0 items-center justify-center rounded-xl bg-success-50">
          <Award className="size-6 text-success-500" />
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
