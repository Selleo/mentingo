import { OnboardingPages } from "@repo/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateCompanyInformation } from "~/api/mutations/admin/useUpdateCompanyInformation";
import { useCurrentUser, useCompanyInformation } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { setPageTitle } from "~/utils/setPageTitle";

import Loader from "../common/Loader/Loader";
import { useTourSetup } from "../Onboarding/hooks/useTourSetup";
import { studentProviderInformationSteps } from "../Onboarding/routes/student";

import { ProviderInformationCard, ProviderInformationEditCard } from "./components";

import type { MetaFunction } from "@remix-run/react";
import type { UpdateCompanyInformationBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.providerInformation");

export default function ProviderInformationPage() {
  const [isEditing, setIsEditing] = useState(false);
  const { t } = useTranslation();

  const { isAdmin, isStudent } = useUserRole();
  const { data: companyInfo, isLoading } = useCompanyInformation();
  const { mutate: updateCompanyInformation, isPending } = useUpdateCompanyInformation();
  const { data: currentUser } = useCurrentUser();

  const steps = useMemo(
    () => (isStudent ? studentProviderInformationSteps(t) : []),
    [t, isStudent],
  );

  useTourSetup({
    steps,
    isLoading,
    hasCompletedTour: currentUser?.onboardingStatus?.providerInformation,
    page: OnboardingPages.PROVIDER_INFORMATION,
  });

  const handleSubmit = (data: UpdateCompanyInformationBody) => {
    const processedData = { ...data };
    if (data.companyName && (!data.companyShortName || data.companyShortName.trim() === "")) {
      if (data.companyName.length <= 11) {
        processedData.companyShortName = data.companyName;
      } else {
        processedData.companyShortName = "";
      }
    }

    updateCompanyInformation(processedData, {
      onSuccess: () => {
        setIsEditing(false);
      },
    });
  };

  const handleCancel = () => setIsEditing(false);

  if (isLoading) {
    return (
      <div className="grid size-full place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <PageWrapper
      role="main"
      breadcrumbs={[
        {
          title: t("providerInformation.breadcrumbs.providerInformation"),
          href: "/provider-information",
        },
      ]}
    >
      <div className="flex flex-col items-center gap-6">
        <section className="flex w-full max-w-[720px] justify-between">
          <h2 id="provider-information" className="h5 md:h3 text-neutral-950">
            {t("providerInformation.title")}
          </h2>
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
