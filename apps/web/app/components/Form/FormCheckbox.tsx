import { type Control, Controller, type FieldValues, type Path } from "react-hook-form";

import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

type FormCheckboxProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  testId?: string;
};

export const FormCheckbox = <T extends FieldValues>({
  control,
  name,
  label,
  testId,
}: FormCheckboxProps<T>) => {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center space-x-2">
          <Checkbox
            data-testid={testId}
            id={name}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
          <Label
            htmlFor={name}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </Label>
        </div>
      )}
    />
  );
};
