import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { USER_ROLE } from "~/config/userRoles";

import Loader from "../common/Loader/Loader";

import { ProviderInformationCard, ProviderInformationEditCard } from "./components";
import { useCompanyInformation, useSaveCompanyInformation } from "./hooks/useCompanyInformation";

import type { CompanyInformationFormValues } from "./schemas/companyInformationFormSchema";

export default function ProviderInformationPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { t } = useTranslation();

  const { data: currentUser } = useCurrentUser();
  const { data: companyInfo, isLoading } = useCompanyInformation();
  const { mutate: saveCompanyInfo, isPending } = useSaveCompanyInformation();

  const isAdmin = currentUser?.role === USER_ROLE.admin;

  const handleSubmit = (data: CompanyInformationFormValues) => {
    saveCompanyInfo(data, {
      onSuccess: () => {
        setIsEditing(false);
      },
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

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
            data={companyInfo || {}}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isPending}
          />
        ) : (
          <ProviderInformationCard data={companyInfo || {}} />
        )}
      </div>
    </PageWrapper>
  );
}
