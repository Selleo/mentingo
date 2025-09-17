import type { GetPromotionCodesResponse } from "~/api/generated-api";

export type TPromotionCode = GetPromotionCodesResponse["data"][number];
