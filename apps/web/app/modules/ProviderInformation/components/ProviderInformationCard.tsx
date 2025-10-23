import { pickBy } from "lodash-es";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { GetCompanyInformationResponse } from "~/api/generated-api";

type ProviderInformationCardProps = {
  companyInformation: GetCompanyInformationResponse["data"] | null;
};

export const ProviderInformationCard = ({ companyInformation }: ProviderInformationCardProps) => {
  const { t } = useTranslation();

  const isCompanyInformationProvided =
    companyInformation && Object.values(companyInformation).filter(Boolean).length > 0;

  const providedCompanyInformation = useMemo(() => {
    if (!isCompanyInformationProvided || !companyInformation) return {};

    return pickBy(
      companyInformation,
      (value) => value !== undefined && value !== null && value !== "",
    );
  }, [companyInformation, isCompanyInformationProvided]);

  if (!isCompanyInformationProvided) {
    return (
      <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <p className="body-base text-neutral-600">
          {t("providerInformation.noCompanyInformationAvailable")}
        </p>
      </section>
    );
  }

  return (
    <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <div className="flex flex-col gap-4">
        {Object.entries(providedCompanyInformation).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-y-2">
            <span className="text-neutral-900">{t(`providerInformation.${key}`)}:</span>
            <span className="font-medium text-neutral-950">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
