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
    return isCompanyInformationProvided ? Object.values(companyInformation).filter(Boolean) : [];
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
        {providedCompanyInformation.map((value, index) => (
          <div key={index} className="flex flex-col gap-y-2">
            <span className="text-neutral-900">
              {t(`providerInformation.${Object.keys(companyInformation)[index]}`)}:
            </span>
            <span className="font-medium text-neutral-950">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
