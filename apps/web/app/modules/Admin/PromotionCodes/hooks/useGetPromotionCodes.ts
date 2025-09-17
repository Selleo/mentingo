import { useTranslation } from "react-i18next";

import type { TPromotionCode } from "../types";

export const useGetPromotionCodeStatus = () => {
  const { t } = useTranslation();

  const getPromotionCodeStatus = (promotionCode: TPromotionCode) => {
    const isActive = promotionCode.active;
    const isMaxRedemptionsReached =
      promotionCode.maxRedemptions && promotionCode.timesRedeemed >= promotionCode.maxRedemptions;
    const isExpired = promotionCode.expiresAt && new Date(promotionCode.expiresAt) < new Date();

    if (isActive) {
      return t("adminPromotionCodesView.status.active", "Active");
    }
    if (isMaxRedemptionsReached) {
      return t("adminPromotionCodesView.status.usageLimitReached", "Usage limit reached");
    }
    if (isExpired) {
      return t("adminPromotionCodesView.status.expired", "Expired");
    }
    return t("adminPromotionCodesView.status.deactivated", "deactivated");
  };

  return { getPromotionCodeStatus };
};
