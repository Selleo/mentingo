import { cva } from "class-variance-authority";

import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";

import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import type { IconName } from "~/types/shared";

const badgeVariants = cva("", {
  variants: {
    variant: {
      default: "text-neutral-900 bg-white border border-neutral-200",
      success: "text-[#008236] bg-[#F0FDF4] border border-[#B9F8CF]",
      successFilled: "text-success-800 bg-success-50",
      inProgress: "text-warning-800 bg-warning-100",
      inProgressFilled: "text-secondary-700 bg-secondary-50",
      notStarted: "text-neutral-600 bg-neutral-100",
      notStartedFilled: "bg-neutral-50 text-neutral-900 details-md",
      blocked: "text-neutral-600 bg-neutral-100",
      blockedFilled: "bg-neutral-50 text-black details-md",
      secondary: "border-transparent bg-secondary text-accent-foreground hover:bg-secondary/80",
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
      className={cn(badgeVariants({ variant, outline, fontWeight }), className, {
        "flex h-min shrink-0 items-center gap-x-2 rounded-lg px-2 py-1 text-sm": children,
      })}
      {...props}
    >
      {icon && <Icon name={icon} {...(iconClasses && { className: iconClasses })} />}
      {children ? children : null}
    </div>
  );
};
