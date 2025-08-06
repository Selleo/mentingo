import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateCompanyInformation } from "~/api/mutations/admin/useUpdateCompanyInformation";
import { useCompanyInformation } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { filterChangedData } from "~/utils/filterChangedData";

import Loader from "../common/Loader/Loader";

import { ProviderInformationCard, ProviderInformationEditCard } from "./components";

import type { UpdateCompanyInformationBody } from "~/api/generated-api";

export default function ProviderInformationPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { t } = useTranslation();

  const { isAdmin } = useUserRole();
  const { data: companyInfo, isLoading } = useCompanyInformation();
  const { mutate: updateCompanyInformation, isPending } = useUpdateCompanyInformation();

  const handleSubmit = (data: UpdateCompanyInformationBody) => {
    const changedData = filterChangedData(data, companyInfo?.data || {});

    if (Object.keys(changedData).length === 0) {
      return;
    }

    updateCompanyInformation(changedData, {
      onSuccess: () => {
        setIsEditing(false);
      },
    });
  };

  const handleCancel = () => setIsEditing(false);

  if (isLoading) {
    return (
      <div className="grid h-full w-full place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <PageWrapper role="main">
      <div className="flex flex-col items-center gap-6">
        <section className="flex w-full max-w-[720px] justify-between">
          <h2 className="h5 md:h3 text-neutral-950">{t("providerInformation.title")}</h2>
          {isAdmin && (
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)} disabled={isPending}>
              {isEditing ? t("common.button.cancel") : t("common.button.edit")}
            </Button>
          )}
        </section>

        {isEditing ? (
          <ProviderInformationEditCard
            companyInformation={companyInfo?.data || null}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isPending}
          />
        ) : (
          <ProviderInformationCard companyInformation={companyInfo?.data || null} />
        )}
      </div>
    </PageWrapper>
  );
}
