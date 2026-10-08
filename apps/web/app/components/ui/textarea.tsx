import * as React from "react";

import { cn } from "~/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
          "mono:rounded mono:border-input mono:text-foreground mono:focus-visible:border-primary-700 mono:focus-visible:ring-2 mono:focus-visible:ring-ring mono:focus-visible:ring-offset-2 mono:aria-[invalid=true]:border-error-500 mono:disabled:bg-neutral-100 mono:disabled:text-neutral-600 mono:disabled:opacity-100",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
