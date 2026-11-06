import { useState } from "react";

import { cn } from "~/lib/utils";
import { hexToHslTuple } from "~/modules/Theme/helpers";
import { useTheme } from "~/modules/Theme/useTheme";

import { ACHIEVEMENT_ICON_COMPONENTS } from "./achievementIcons";

import type { AchievementIcon } from "@repo/shared";

// Served as files rather than inlined components: 12 colours x 3 tiers would bloat the bundle.
const BADGE_URLS = import.meta.glob<string>("../../assets/svgs/achievements/*/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

// Base fill of each badge colour set, used to match the tenant's primary colour.
const BADGE_COLOR_HEXES = {
  mentingo: "#058AEA",
  blue: "#054CEA",
  dark_blue: "#0535EA",
  indigo: "#3105EA",
  cyan: "#0598EA",
  teal: "#05EAEA",
  green: "#05EA29",
  amber: "#EAA805",
  orange: "#EA6005",
  red: "#EA0505",
  pink: "#EA0561",
  magenta: "#EA05E1",
} as const;

export type AchievementBadgeColor = keyof typeof BADGE_COLOR_HEXES;

const DEFAULT_BADGE_COLOR: AchievementBadgeColor = "mentingo";
// Below this saturation a theme colour is effectively grey, so its hue says nothing.
const MIN_THEME_SATURATION = 15;

const hueDistance = (first: number, second: number) => {
  const distance = Math.abs(first - second) % 360;

  return Math.min(distance, 360 - distance);
};

/** Picks the badge colour set whose hue is closest to the theme's primary colour. */
export const getClosestBadgeColor = (primaryColor: string): AchievementBadgeColor => {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(primaryColor)) return DEFAULT_BADGE_COLOR;

  const [hue, saturation] = hexToHslTuple(primaryColor);

  if (saturation < MIN_THEME_SATURATION) return DEFAULT_BADGE_COLOR;

  const distanceTo = (color: AchievementBadgeColor) =>
    hueDistance(hexToHslTuple(BADGE_COLOR_HEXES[color])[0], hue);

  return (Object.keys(BADGE_COLOR_HEXES) as AchievementBadgeColor[]).reduce((closest, color) =>
    distanceTo(color) < distanceTo(closest) ? color : closest,
  );
};

const BADGE_TIER_COUNT = 3;

/** Level N uses badge tier N; levels outside 1-3 are clamped so a badge always resolves. */
export const getAchievementBadgeUrl = (color: AchievementBadgeColor, level: number) => {
  const tier = Math.min(Math.max(Math.trunc(level), 1), BADGE_TIER_COUNT);

  return BADGE_URLS[`../../assets/svgs/achievements/${color}/tier_${tier}.svg`];
};

/** The uploaded badge when there is one, otherwise the level's tier badge in the theme colour. */
export const useAchievementBadgeUrl = (level: number, badgeImageUrl?: string | null) => {
  const { primaryColor } = useTheme();

  return badgeImageUrl || getAchievementBadgeUrl(getClosestBadgeColor(primaryColor), level);
};

type AchievementBadgeProps = {
  level: number;
  icon: AchievementIcon;
  badgeImageUrl?: string | null;
  isEarned?: boolean;
  className?: string;
};

export function AchievementBadge({
  level,
  icon,
  badgeImageUrl,
  isEarned = true,
  className,
}: AchievementBadgeProps) {
  // An expired or deleted upload falls back to the tier badge rather than a broken image.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const uploadedUrl = badgeImageUrl && badgeImageUrl !== failedImageUrl ? badgeImageUrl : null;
  const src = useAchievementBadgeUrl(level, uploadedUrl);
  const Icon = ACHIEVEMENT_ICON_COMPONENTS[icon];

  return (
    <span
      aria-hidden
      className={cn(
        // Every tier shares an 88x62 canvas, so the hexagon is the same size with or without wings.
        "relative inline-flex aspect-[88/62] h-10 shrink-0",
        !isEarned && "opacity-40 grayscale",
        className,
      )}
    >
      <img
        src={src}
        alt=""
        className="size-full object-contain"
        onError={() => uploadedUrl && setFailedImageUrl(uploadedUrl)}
      />
      {/* Uploaded badges are the admin's own artwork, so only tier badges get the icon. */}
      {!uploadedUrl && (
        <Icon
          strokeWidth={2.5}
          className="absolute left-1/2 top-[52%] aspect-square h-[38%] w-auto -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-sm"
        />
      )}
    </span>
  );
}
