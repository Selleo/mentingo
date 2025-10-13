import { useTranslation } from "react-i18next";

import { IconX, Search } from "../../assets/svgs";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";

import type { ChangeEvent, ReactNode } from "react";
import type { InputProps } from "~/components/ui/input";

export type SearchInputProps = InputProps & {
  wrapperClassName?: string;
  clearable?: boolean;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  rightAdornment?: ReactNode;
};

export const SearchInput = ({
  rightAdornment,
  clearable,
  wrapperClassName,
  ...props
}: SearchInputProps) => {
  const { t } = useTranslation();
  return (
    <div className={cn("group relative max-w-2xl flex-grow", wrapperClassName)}>
      <Search className="absolute left-2 top-1/2 size-5 -translate-y-1/2 transform text-neutral-800 transition-colors group-focus-within:text-primary-500" />
      <Input
        type="text"
        {...props}
        placeholder={props.placeholder || `${t("common.other.search")}...`}
        className={cn(
          "w-full max-w-[320px] border border-neutral-200 py-2 pl-8 focus:border-primary-500 md:max-w-none",
          clearable ? "pr-8" : "pr-4",
          props.className,
        )}
      />
      {rightAdornment}
      {clearable && props.value && props.value.length > 0 && (
        <IconX
          width={16}
          height={16}
          className="absolute end-2 top-1/2 -translate-y-1/2 transform cursor-pointer text-neutral-800"
          onClick={() =>
            props.onChange?.({ target: { value: "" } } as ChangeEvent<HTMLInputElement>)
          }
        />
      )}
    </div>
  );
};
