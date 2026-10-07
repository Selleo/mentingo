import * as React from "react";

import { IS_MONO_DESIGN } from "~/config/designVariant";
import { cn } from "~/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "body-base !mt-0 flex h-[42px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 accent-accent-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          IS_MONO_DESIGN &&
            "h-10 rounded border-input placeholder:text-neutral-700 focus-visible:border-primary-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-[invalid=true]:border-error-500 disabled:bg-neutral-100 disabled:text-neutral-600 disabled:opacity-100",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
