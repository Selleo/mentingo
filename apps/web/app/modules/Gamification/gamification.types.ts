import type { GetUserGamificationProfileResponse } from "~/api/generated-api";

export type UserGamificationProfile = GetUserGamificationProfileResponse["data"];

export type UserAchievement = UserGamificationProfile["achievements"][number];
