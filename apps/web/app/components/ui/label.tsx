import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

const labelVariants = cva(
  [
    "body-base-md text-neutral-95- peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
    "mono:font-control mono:text-sm mono:font-semibold mono:text-neutral-950",
  ],
  {
    variants: {
      variant: {
        default: null,
        option: "mono:font-[inherit] mono:font-normal mono:leading-5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, variant, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ variant }), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
