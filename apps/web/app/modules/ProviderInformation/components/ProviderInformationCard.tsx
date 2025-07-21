import { useTranslation } from "react-i18next";

import type { CompanyInformationFormValues } from "../schemas/companyInformationFormSchema";

type ProviderInformationCardProps = {
  data: CompanyInformationFormValues;
};

type InfoRowProps = {
  label: string;
  value: string;
};

const InfoRow = ({ label, value }: InfoRowProps) => (
  <div className="flex flex-col gap-y-2">
    <span className="text-neutral-900">{label}:</span>
    <span className="font-medium text-neutral-950">{value}</span>
  </div>
);

export const ProviderInformationCard = ({ data }: ProviderInformationCardProps) => {
  const { t } = useTranslation();

  const isEmpty = !data || Object.values(data).every((value) => !value);

  if (isEmpty) {
    return (
      <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <p className="body-base text-neutral-600">{t("providerInformation.noDataAvailable")}</p>
      </section>
    );
  }

  return (
    <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <div className="flex flex-col gap-4">
        {data.company_name && (
          <InfoRow label={t("providerInformation.companyName")} value={data.company_name} />
        )}
        {data.registered_address && (
          <InfoRow
            label={t("providerInformation.registeredAddress")}
            value={data.registered_address}
          />
        )}
        {data.tax_number && (
          <InfoRow label={t("providerInformation.taxNumber")} value={data.tax_number} />
        )}
        {data.email_address && (
          <InfoRow label={t("providerInformation.emailAddress")} value={data.email_address} />
        )}
        {data.court_register_number && (
          <InfoRow
            label={t("providerInformation.courtRegisterNumber")}
            value={data.court_register_number}
          />
        )}
      </div>
    </section>
  );
};
