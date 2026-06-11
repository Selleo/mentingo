import { HexColorInput, HexColorPicker } from "react-colorful";

import { cn } from "~/lib/utils";

interface ColorPickerFieldProps {
  color: string;
  inputId?: string;
  inputTestId?: string;
  onChange: (color: string) => void;
  className?: string;
}

export const ColorPickerField = ({
  color,
  inputId,
  inputTestId,
  onChange,
  className,
}: ColorPickerFieldProps) => (
  <div className={cn("color-picker-field flex flex-col", className)}>
    <HexColorPicker className="color-picker-field__picker" color={color} onChange={onChange} />
    <div className="relative w-full">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
        #
      </span>
      <HexColorInput
        color={color}
        id={inputId}
        onChange={onChange}
        className="body-base !mt-0 flex h-[42px] w-full rounded-b-lg rounded-t-none border border-t-0 border-neutral-300 bg-white py-2 pl-7 pr-3 text-sm text-neutral-950 accent-accent-foreground placeholder:text-neutral-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        data-testid={inputTestId}
      />
    </div>
  </div>
);
