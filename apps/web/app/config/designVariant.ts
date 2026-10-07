export const DESIGN_VARIANTS = {
  DEFAULT: "default",
  MONO: "mono",
} as const;

export type DesignVariant = (typeof DESIGN_VARIANTS)[keyof typeof DESIGN_VARIANTS];

const configuredDesignVariant = import.meta.env.VITE_DESIGN_VARIANT;

// Set per build, so every tenant served by one build shares the same design.
export const DESIGN_VARIANT: DesignVariant = Object.values(DESIGN_VARIANTS).includes(
  configuredDesignVariant,
)
  ? configuredDesignVariant
  : DESIGN_VARIANTS.DEFAULT;

export const IS_MONO_DESIGN = DESIGN_VARIANT === DESIGN_VARIANTS.MONO;
