import MultipleSelector from "~/components/ui/multiselect";

import type { ReactNode } from "react";
import type { Option } from "~/components/ui/multiselect";

type UserMultiSelectProps = {
  value: string[];
  options: Option[];
  onChange: (value: string[]) => void;
  placeholder: string;
  testId?: string;
  getOptionTestId?: (option: Option) => string;
  emptyIndicator?: ReactNode;
};

export const UserMultiSelect = ({
  value,
  options,
  onChange,
  placeholder,
  testId,
  getOptionTestId,
  emptyIndicator,
}: UserMultiSelectProps) => (
  <MultipleSelector
    testId={testId}
    getOptionTestId={getOptionTestId}
    value={value.map((selectedValue) => {
      const option = options.find(({ value: optionValue }) => optionValue === selectedValue);
      return option ?? { value: selectedValue, label: selectedValue };
    })}
    options={options}
    onChange={(selectedOptions) => onChange(selectedOptions.map(({ value }) => value))}
    placeholder={placeholder}
    hidePlaceholderWhenSelected
    hideClearAllButton
    emptyIndicator={emptyIndicator}
    className="w-full bg-background p-2"
    badgeClassName="bg-accent text-accent-foreground text-sm hover:bg-accent"
    commandProps={{ label: placeholder }}
    inputProps={{ className: "w-full outline-none py-0 body-base" }}
    checkbox={false}
  />
);
