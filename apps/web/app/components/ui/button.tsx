import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { IS_MONO_DESIGN } from "~/config/designVariant";
import { cn } from "~/lib/utils";

const defaultButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary-700 text-contrast hover:opacity-90",
        destructive: "bg-destructive text-primary-foreground hover:opacity-90",
        outline:
          "border border-input bg-background text-primary-800 hover:text-accent-foreground hover:border-primary-500 hover:opacity-90",
        primary: "bg-primary-700 text-contrast hover:opacity-90",
        secondary: "bg-secondary-600 text-contrast hover:opacity-90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "size-10",
        xs: "h-6 rounded-md p-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const monoButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded font-control text-sm font-semibold tracking-wide ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary-700 text-contrast hover:bg-primary-800 focus-visible:bg-primary-800 active:bg-primary-900 disabled:bg-neutral-200 disabled:text-white",
        destructive:
          "bg-error-500 text-white hover:bg-error-600 focus-visible:bg-error-600 active:bg-error-700 disabled:bg-neutral-200 disabled:text-white",
        outline:
          "border border-input bg-background text-foreground hover:bg-primary-50 focus-visible:bg-primary-50 active:bg-primary-100 disabled:border-neutral-300 disabled:text-neutral-600",
        primary:
          "bg-primary-700 text-contrast hover:bg-primary-800 focus-visible:bg-primary-800 active:bg-primary-900 disabled:bg-neutral-200 disabled:text-white",
        secondary:
          "border border-primary-700 bg-background text-primary-700 hover:bg-primary-50 focus-visible:bg-primary-50 active:bg-primary-100 disabled:border-neutral-300 disabled:text-neutral-600",
        ghost:
          "text-primary-700 hover:bg-primary-50 focus-visible:bg-primary-50 active:bg-primary-100 disabled:text-neutral-600",
        link: "text-primary-700 underline-offset-4 hover:underline disabled:text-neutral-600",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8 text-base",
        icon: "size-10",
        xs: "h-6 p-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonVariants = IS_MONO_DESIGN ? monoButtonVariants : defaultButtonVariants;

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
