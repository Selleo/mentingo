import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    "mono:rounded mono:font-control mono:font-semibold mono:tracking-wide mono:disabled:opacity-100",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-primary-700 text-contrast hover:opacity-90",
          "mono:hover:bg-primary-800 mono:hover:opacity-100 mono:focus-visible:bg-primary-800 mono:active:bg-primary-900 mono:disabled:bg-neutral-200 mono:disabled:text-white",
        ],
        destructive: [
          "bg-destructive text-primary-foreground hover:opacity-90",
          "mono:bg-error-500 mono:text-white mono:hover:bg-error-600 mono:hover:opacity-100 mono:focus-visible:bg-error-600 mono:active:bg-error-700 mono:disabled:bg-neutral-200 mono:disabled:text-white",
        ],
        outline: [
          "border border-input bg-background text-primary-800 hover:text-accent-foreground hover:border-primary-500 hover:opacity-90",
          "mono:text-foreground mono:hover:border-input mono:hover:bg-primary-50 mono:hover:text-foreground mono:hover:opacity-100 mono:focus-visible:bg-primary-50 mono:active:bg-primary-100 mono:disabled:border-neutral-300 mono:disabled:text-neutral-600",
        ],
        primary: [
          "bg-primary-700 text-contrast hover:opacity-90",
          "mono:hover:bg-primary-800 mono:hover:opacity-100 mono:focus-visible:bg-primary-800 mono:active:bg-primary-900 mono:disabled:bg-neutral-200 mono:disabled:text-white",
        ],
        secondary: [
          "bg-secondary-600 text-contrast hover:opacity-90",
          "mono:border mono:border-primary-700 mono:bg-background mono:text-primary-700 mono:hover:bg-primary-50 mono:hover:opacity-100 mono:focus-visible:bg-primary-50 mono:active:bg-primary-100 mono:disabled:border-neutral-300 mono:disabled:text-neutral-600",
        ],
        ghost: [
          "hover:bg-accent hover:text-accent-foreground",
          "mono:text-primary-700 mono:focus-visible:bg-primary-50 mono:active:bg-primary-100 mono:disabled:text-neutral-600",
        ],
        link: [
          "text-primary underline-offset-4 hover:underline",
          "mono:text-primary-700 mono:disabled:text-neutral-600",
        ],
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: ["h-9 rounded-lg px-3", "mono:rounded"],
        lg: ["h-11 rounded-lg px-8", "mono:rounded mono:text-base"],
        icon: "size-10",
        xs: ["h-6 rounded-md p-1 text-xs", "mono:rounded"],
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
