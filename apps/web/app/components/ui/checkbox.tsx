import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import * as React from "react";

import { cn } from "~/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { isSquareCheck?: boolean }
>(({ className, isSquareCheck, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      isSquareCheck
        ? "mb-1 flex size-5 shrink-0 items-center justify-center rounded-sm border border-primary-700"
        : "data-[state=checked]:text-white peer size-4 shrink-0 rounded-sm border border-accent-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      {props.checked === "indeterminate" && <Minus className="size-4" />}

      {isSquareCheck && <div className="border-px h-[9px] w-[9px] bg-primary-700" />}

      {!isSquareCheck && props.checked !== "indeterminate" && <Check className="size-4" />}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
