import { useParams } from "@remix-run/react";
import { keyBy } from "lodash-es";
import { useTranslation } from "react-i18next";

import { useUpdatePromotionCode } from "~/api/mutations/useUpdatePromotionCode";
import { useCoursesSuspense } from "~/api/queries";
import { usePromotionCodeByIdSuspense } from "~/api/queries/admin/usePromotionCodeById";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

import { CreatePageHeader } from "../components";

import { useGetPromotionCodeStatus } from "./hooks/useGetPromotionCodes";

const PromotionCodeDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: promotionCode } = usePromotionCodeByIdSuspense(id as string);
  const { data: courses } = useCoursesSuspense();
  const { mutateAsync: updatePromotionCode, isPending: isUpdatePromotionCodePending } =
    useUpdatePromotionCode();
  const { getPromotionCodeStatus } = useGetPromotionCodeStatus();
  const coursesById = keyBy(courses, "id");

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
        <Button
          variant="outline"
          onClick={handleCouponActivation}
          disabled={isUpdatePromotionCodePending}
        >
          {isCouponActive
            ? t("adminPromotionCodesView.button.deactivatePromotionCode")
            : t("adminPromotionCodesView.button.activatePromotionCode")}
        </Button>
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
                  ? `${promotionCode?.coupon.amountOff} zł`
                  : `${promotionCode?.coupon.percentOff}%`}
              </div>
            </div>
            <div className="py-2">
              <label className="text-sm text-gray-500">
                {t("adminPromotionCodesView.field.expiresAt")}
              </label>
              <div className="text-lg">
                {(promotionCode?.expiresAt &&
                  new Date(promotionCode?.expiresAt).toLocaleString()) ??
                  "n/a"}
              </div>
              <div className="py-2">
                <label className="text-sm text-gray-500">
                  {t("adminPromotionCodesView.field.createdAt")}
                </label>
                <div className="text-lg">
                  {(promotionCode?.created && new Date(promotionCode?.created).toLocaleString()) ??
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
              {promotionCode?.metadata?.assignedCourseIds?.length > 0 ? (
                <>
                  {promotionCode?.metadata?.assignedCourseIds
                    ?.split(",")
                    .map((courseId: string) => (
                      <li key={courseId} className="text-sm">
                        {coursesById[courseId]?.title}
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
