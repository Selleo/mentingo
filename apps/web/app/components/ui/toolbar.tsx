import {
  ToggleGroup as ToggleGroupPrimitive,
  Toolbar as ToolbarPrimitive,
} from "@radix-ui/react-toolbar";

import { cn } from "~/lib/utils";

import type React from "react";

interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

const Toolbar = ({ children, className }: ToolbarProps) => {
  return (
    <ToolbarPrimitive
      className={cn(
        "bg-secondary/40 sticky inset-x-0 top-0 z-[1] my-2 rounded-sm px-4 py-2 backdrop-blur-lg",
        className,
      )}
    >
      {children}
    </ToolbarPrimitive>
  );
};

const ToggleGroup = ToggleGroupPrimitive;

ToggleGroup.displayName = ToggleGroupPrimitive.displayName;

export { Toolbar, ToggleGroup };
