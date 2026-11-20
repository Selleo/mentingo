import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold tracking-tight ring-offset-background transition-all duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-brand brand-gradient text-contrast brand-glow hover:-translate-y-0.5 hover:brightness-110",
        destructive:
          "bg-destructive text-primary-foreground shadow-[0_10px_24px_-12px_var(--error-500)] hover:-translate-y-0.5 hover:brightness-110",
        outline:
          "border-2 border-primary-200 bg-background text-primary-800 hover:-translate-y-0.5 hover:border-primary-500 hover:bg-primary-50 hover:text-accent-foreground",
        primary:
          "bg-brand brand-gradient text-contrast brand-glow hover:-translate-y-0.5 hover:brightness-110",
        secondary:
          "bg-secondary-600 text-contrast shadow-[0_10px_24px_-12px_var(--secondary-600)] hover:-translate-y-0.5 hover:brightness-110",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-12 rounded-2xl px-8 text-base",
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
