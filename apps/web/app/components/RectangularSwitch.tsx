import { useId } from "react";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

interface RectangularSwitchProps {
  switchLabel: string;
  onLabel: string;
  offLabel: string;
  toggled: boolean;
  setToggled: (value: boolean) => void;
  className?: string;
}
export default function RectangularSwitch({
  toggled,
  setToggled,
  switchLabel,
  onLabel,
  offLabel,
  className,
}: RectangularSwitchProps) {
  const id = useId();

  return (
    <div>
      <div
        className={cn(
          "relative inline-grid h-7 grid-cols-[1fr_1fr] items-center text-sm font-medium",
          className,
        )}
      >
        <Switch
          id={id}
          checked={toggled}
          onCheckedChange={setToggled}
          onClick={(e) => e.stopPropagation()}
          className="peer absolute inset-0 h-[inherit] w-auto rounded-md data-[state=unchecked]:bg-neutral-100 [&_span]:z-10 [&_span]:h-full [&_span]:w-1/2 [&_span]:rounded-sm [&_span]:transition-transform [&_span]:duration-300 [&_span]:ease-[cubic-bezier(0.16,1,0.3,1)] [&_span]:data-[state=checked]:translate-x-full [&_span]:data-[state=checked]:rtl:-translate-x-full"
        />
        <span className="pointer-events-none relative ms-0.5 flex items-center justify-center px-2 text-center transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] peer-data-[state=checked]:invisible peer-data-[state=unchecked]:translate-x-full peer-data-[state=unchecked]:rtl:-translate-x-full">
          <span className="text-[10px] font-medium uppercase">{offLabel}</span>
        </span>
        <span className="pointer-events-none relative me-0.5 flex items-center justify-center px-2 text-center transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] peer-data-[state=checked]:-translate-x-full peer-data-[state=checked]:text-background peer-data-[state=unchecked]:invisible peer-data-[state=checked]:rtl:translate-x-full">
          <span className="text-[10px] font-medium uppercase">{onLabel}</span>
        </span>
      </div>
      <Label htmlFor={id} className="sr-only">
        {switchLabel}
      </Label>
    </div>
  );
}
