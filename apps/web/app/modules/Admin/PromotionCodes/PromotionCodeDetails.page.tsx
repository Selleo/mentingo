import { useParams } from "@remix-run/react";
import { keyBy } from "lodash-es";
import { useTranslation } from "react-i18next";

import { useUpdatePromotionCode } from "~/api/mutations/useUpdatePromotionCode";
import { useCoursesSuspense } from "~/api/queries";
import { usePromotionCodeByIdSuspense } from "~/api/queries/admin/usePromotionCodeById";
import { PageWrapper } from "~/components/PageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Toggle } from "~/components/ui/toggle";
import { formatPrice } from "~/lib/formatters/priceFormatter";

import { CreatePageHeader } from "../components";

import { useGetPromotionCodeStatus } from "./hooks/useGetPromotionCodes";

import type { MetaFunction } from "@remix-run/react";
import type { CurrencyCode } from "~/lib/formatters/priceFormatter";
import type { ParentRouteData } from "~/modules/layout";

export const meta: MetaFunction = ({ matches }) => {
  const parentMatch = matches.find((match) => match.id.includes("layout"));
  const companyShortName = (parentMatch?.data as ParentRouteData)?.companyInfo?.data
    ?.companyShortName;
  const title = companyShortName
    ? `${companyShortName} - Promotion code details`
    : "Promotion code details";

  return [{ title }];
};

const PromotionCodeDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: promotionCode } = usePromotionCodeByIdSuspense(id as string);
  const { data: courses } = useCoursesSuspense();
  const { mutateAsync: updatePromotionCode, isPending: isUpdatePromotionCodePending } =
    useUpdatePromotionCode();
  const { getPromotionCodeStatus } = useGetPromotionCodeStatus();
  const coursesById = keyBy(courses, "stripeProductId");

  const breadcrumbs = [
    { title: t("adminPromotionCodesView.breadcrumbs.dashboard"), href: "/" },
    {
      title: t("adminPromotionCodesView.breadcrumbs.promotionCodes"),
      href: "/admin/promotion-codes",
    },
    {
      title: t("adminPromotionCodesView.breadcrumbs.update"),
      href: `/admin/promotion-codes/${id}`,
    },
  ];

  const handleCouponActivation = () => {
    updatePromotionCode({
      id: promotionCode?.id,
      data: {
        active: !promotionCode?.active,
      },
    });
  };

  const backButton = {
    title: t("adminPromotionCodesView.breadcrumbs.back"),
    href: "/admin/promotion-codes",
  };

  const isCouponActive = promotionCode?.active;

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton}>
      <CreatePageHeader title={t("adminPromotionCodesView.headers.update")} description="" />
      <div className="flex justify-end gap-3 pb-4">
        <Toggle
          pressed={true}
          onPressedChange={handleCouponActivation}
          disabled={isUpdatePromotionCodePending}
          aria-label="Coupon Activation"
        >
          {isCouponActive
            ? t("adminPromotionCodesView.button.deactivatePromotionCode")
            : t("adminPromotionCodesView.button.activatePromotionCode")}
        </Toggle>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("adminPromotionCodesView.other.baseInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-2">
              <label className="text-sm text-gray-500">
                {t("adminPromotionCodesView.field.code")}
              </label>
              <div className="text-lg">{promotionCode?.code ?? "n/a"}</div>
            </div>
            <div className="py-2">
              <label className="text-sm text-gray-500">
                {t("adminPromotionCodesView.field.status")}
              </label>
              <div className="text-lg">{getPromotionCodeStatus(promotionCode) ?? "n/a"}</div>
            </div>
            <div className="py-2">
              <label className="text-sm text-gray-500">
                {t("adminPromotionCodesView.field.discount")}
              </label>
              <div className="text-lg">
                {promotionCode?.coupon.amountOff
                  ? formatPrice(
                      Number(promotionCode?.coupon.amountOff),
                      promotionCode?.coupon.currency as CurrencyCode,
                    )
                  : `${promotionCode?.coupon.percentOff}%`}
              </div>
            </div>
            <div className="py-2">
              <label className="text-sm text-gray-500">
                {t("adminPromotionCodesView.field.expiresAt")}
              </label>
              <div className="text-lg">
                {promotionCode?.expiresAt
                  ? new Date(promotionCode.expiresAt * 1000).toLocaleString()
                  : "n/a"}
              </div>
              <div className="py-2">
                <label className="text-sm text-gray-500">
                  {t("adminPromotionCodesView.field.createdAt")}
                </label>
                <div className="text-lg">
                  {(promotionCode?.created &&
                    new Date(promotionCode?.created * 1000).toLocaleString()) ??
                    "n/a"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("adminPromotionCodesView.other.usageInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-2">
              <label className="text-sm text-gray-500">
                {t("adminPromotionCodesView.other.usageAmount")}
              </label>
              <div className="text-lg">{promotionCode?.timesRedeemed ?? "n/a"}</div>
            </div>
            <div className="py-2">
              <label className="text-sm text-gray-500">
                {t("adminPromotionCodesView.field.maxRedemptions")}
              </label>
              <div className="text-lg">{promotionCode?.maxRedemptions ?? "n/a"}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("adminPromotionCodesView.field.associatedCourses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc">
              {promotionCode?.coupon?.appliesTo?.length > 0 ? (
                <>
                  {promotionCode?.coupon?.appliesTo?.map((stripeProductId: string) => (
                    <li key={stripeProductId} className="text-sm">
                      {coursesById[stripeProductId]?.title}
                    </li>
                  ))}
                </>
              ) : (
                <p className="text-sm text-neutral-500">
                  {t("adminPromotionCodesView.other.noCourses")}
                </p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
};

export default PromotionCodeDetails;
