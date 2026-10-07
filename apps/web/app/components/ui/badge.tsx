import { cva } from "class-variance-authority";

import { Icon } from "~/components/Icon";
import { IS_MONO_DESIGN } from "~/config/designVariant";
import { cn } from "~/lib/utils";

import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import type { IconName } from "~/types/shared";

const defaultBadgeVariants = cva("", {
  variants: {
    variant: {
      default: "text-neutral-900 bg-white border border-neutral-200",
      success: "text-success-700 bg-success-50 border border-success-200",
      successFilled: "text-success-800 bg-success-50",
      inProgress: "text-warning-800 bg-warning-100",
      inProgressFilled: "text-secondary-700 bg-secondary-50",
      notStarted: "text-neutral-600 bg-neutral-100",
      notStartedFilled: "bg-neutral-50 text-neutral-900 details-md",
      blocked: "text-neutral-600 bg-neutral-100",
      blockedFilled: "bg-neutral-50 text-black details-md",
      secondary: "border-transparent bg-secondary text-accent-foreground hover:bg-secondary/80",
      secondaryWithOutline:
        "border-transparent bg-secondary text-accent-foreground hover:bg-secondary/80 border border-primary-300",
      destructive:
        "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
      outline: "text-foreground",
      draft: "text-yellow-600 bg-warning-50",
      icon: "",
    },
    outline: {
      true: "bg-transparent border border-current",
      false: "",
    },
    fontWeight: {
      normal: "font-normal",
      medium: "font-medium",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    variant: "default",
    outline: false,
    fontWeight: "medium",
  },
});

// Mono: tag badges keep sentence case; status badges are pills with an uppercase control label and,
// unless filled, a dot in the text color.
const MONO_STATUS =
  "rounded-full font-control font-semibold uppercase tracking-wide before:size-1.5 before:shrink-0 before:rounded-full before:bg-current";
const MONO_FILLED = "rounded-full font-control font-semibold uppercase tracking-wide";

const monoBadgeVariants = cva("", {
  variants: {
    variant: {
      default: "rounded border border-neutral-300 bg-background text-foreground",
      secondary: "rounded bg-primary-50 text-primary-700",
      secondaryWithOutline: "rounded border border-primary-700 bg-primary-50 text-primary-700",
      outline: "rounded border border-input text-foreground",
      success: `${MONO_STATUS} bg-success-50 text-success-700`,
      inProgress: `${MONO_STATUS} bg-primary-50 text-primary-700`,
      notStarted: `${MONO_STATUS} bg-neutral-100 text-neutral-950`,
      blocked: `${MONO_STATUS} bg-neutral-100 text-neutral-950`,
      draft: `${MONO_STATUS} bg-warning-50 text-warning-700`,
      destructive: `${MONO_STATUS} bg-error-50 text-error-500`,
      successFilled: `${MONO_FILLED} bg-success-50 text-success-700`,
      inProgressFilled: `${MONO_FILLED} bg-primary-50 text-primary-700`,
      notStartedFilled: `${MONO_FILLED} bg-neutral-100 text-neutral-950`,
      blockedFilled: `${MONO_FILLED} bg-neutral-100 text-neutral-950`,
      icon: "",
    },
    outline: {
      true: "border border-current bg-transparent",
      false: "",
    },
    fontWeight: {
      normal: "font-normal",
      medium: "",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    variant: "default",
    outline: false,
    fontWeight: "medium",
  },
});

const badgeVariants = IS_MONO_DESIGN ? monoBadgeVariants : defaultBadgeVariants;

const badgeLayout = IS_MONO_DESIGN
  ? "flex h-min shrink-0 items-center gap-x-1.5 px-2 py-0.5 text-xs"
  : "flex h-min shrink-0 items-center gap-x-2 rounded-lg px-2 py-1 text-sm";

type BadgeProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants> & {
    icon?: IconName;
    iconClasses?: string;
  };

export const Badge = ({
  className,
  variant,
  fontWeight,
  outline,
  icon,
  children,
  iconClasses,
  ...props
}: BadgeProps) => {
  return (
    <div
      className={cn(
        badgeVariants({ variant, outline, fontWeight }),
        children && badgeLayout,
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} {...(iconClasses && { className: iconClasses })} />}
      {children ? children : null}
    </div>
  );
};
