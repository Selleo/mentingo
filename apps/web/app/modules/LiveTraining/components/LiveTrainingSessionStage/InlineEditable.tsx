import { forwardRef } from "react";

import { cn } from "~/lib/utils";

import "./LiveTrainingSessionStage.css";

import type { InlineEditableProps } from "./LiveTrainingSessionStage.types";
import type { ForwardedRef } from "react";

function InlineEditableComponent(
  { children, className, variant = "chip" }: InlineEditableProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded transition-colors",
        {
          "border border-white/20 hover:border-dotted hover:border-white/60 focus-within:border-solid focus-within:border-white/75":
            variant === "chip",
          "live-training-inline-editable--text": variant === "text",
        },
        className,
      )}
    >
      {children}
    </div>
  );
}

export const InlineEditable = forwardRef(InlineEditableComponent);
