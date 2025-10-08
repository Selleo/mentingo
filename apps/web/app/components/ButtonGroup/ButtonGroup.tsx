import { cn } from "~/lib/utils";

import { Button, type ButtonProps } from "../ui/button";

import type { ReactNode } from "react";

interface SingleButtonProps extends ButtonProps {
  children: ReactNode;
  isActive: boolean;
}

type ButtonGroupProps = {
  className?: string;
  buttons: SingleButtonProps[];
};

export const ButtonGroup = ({ className, buttons }: ButtonGroupProps) => {
  return (
    <div
      className={cn(
        "h-min max-w-fit whitespace-nowrap rounded-lg border border-neutral-300 bg-neutral-50",
        className,
      )}
    >
      {buttons.map(({ isActive, ...button }, index) => (
        <Button
          key={index}
          {...button}
          className={cn({
            "bg-white text-accent-foreground shadow-primary": isActive,
            "bg-neutral-50 text-neutral-400": !isActive,
          })}
        />
      ))}
    </div>
  );
};
