import { Award } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import type { TFunction } from "i18next";

type CertificateStatCardProps = {
  completionDate?: string;
  expiryDate?: string;
  hasCertificate: boolean;
  isAdminExperience: boolean;
  isCertificateAvailable?: boolean;
  onOpen: () => void;
};

const getCertificateStatusLabel = (
  isAdminExperience: boolean,
  hasCertificate: boolean,
  t: TFunction,
) => {
  if (!isAdminExperience) return t("modernCourseView.stats.notIssuedYet");
  return hasCertificate
    ? t("modernCourseView.common.enabled")
    : t("modernCourseView.common.disabled");
};

export default function CertificateStatCard({
  completionDate,
  expiryDate,
  hasCertificate,
  isAdminExperience,
  isCertificateAvailable = false,
  onOpen,
}: CertificateStatCardProps) {
  const { t } = useTranslation();
  const isInteractive = isAdminExperience || isCertificateAvailable;

  return (
    <button
      type="button"
      disabled={!isInteractive}
      onClick={isInteractive ? onOpen : undefined}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl bg-white p-4 pl-6 text-left shadow-sm",
        {
          "cursor-pointer transition-all hover:bg-neutral-50 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-2":
            isInteractive,
          "opacity-50 hover:bg-neutral-100 hover:opacity-75": isAdminExperience && !hasCertificate,
        },
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-success-500" aria-hidden="true" />
      <div className="flex items-center gap-4">
        <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-xl bg-success-50">
          <Award className="size-6 text-success-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-neutral-800">
            {t("modernCourseView.stats.certificate")}
          </p>
          {isCertificateAvailable && completionDate ? (
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              <div>
                <dt className="text-xs text-neutral-800">
                  {t("modernCourseView.stats.certificateDate")}
                </dt>
                <dd className="whitespace-nowrap text-lg font-bold text-neutral-950">
                  {completionDate}
                </dd>
              </div>
              {expiryDate && (
                <div>
                  <dt className="text-xs text-neutral-800">
                    {t("modernCourseView.stats.certificateExpiry")}
                  </dt>
                  <dd className="whitespace-nowrap text-lg font-bold text-neutral-950">
                    {expiryDate}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-xl font-bold text-neutral-950">
              {getCertificateStatusLabel(isAdminExperience, hasCertificate, t)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
