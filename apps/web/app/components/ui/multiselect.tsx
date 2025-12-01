"use client";

import { Command as CommandPrimitive, useCommandState } from "cmdk";
import { ChevronDown, XIcon } from "lucide-react";
import * as React from "react";
import { useEffect } from "react";

import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Command, CommandGroup, CommandItem, CommandList } from "~/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export interface Option {
  value: string;
  label: string;
  disable?: boolean;
  /** fixed option that can't be removed. */
  fixed?: boolean;
  /** Group the options by providing key. */
  [key: string]: string | boolean | undefined;
}

export type CheckboxState = { id: string; state: "indeterminate" | boolean };
interface GroupOption {
  [key: string]: Option[];
}

interface MultipleSelectorProps {
  value?: Option[];
  defaultOptions?: Option[];
  /** manually controlled options */
  options?: Option[];
  placeholder?: string;
  /** Loading component. */
  loadingIndicator?: React.ReactNode;
  /** Empty component. */
  emptyIndicator?: React.ReactNode;
  /** Debounce time for async search. Only work with `onSearch`. */
  delay?: number;
  /**
   * Only work with `onSearch` prop. Trigger search when `onFocus`.
   * For example, when user click on the input, it will trigger the search to get initial options.
   **/
  triggerSearchOnFocus?: boolean;
  /** async search */
  onSearch?: (value: string) => Promise<Option[]>;
  /**
   * sync search. This search will not showing loadingIndicator.
   * The rest props are the same as async search.
   * i.e.: creatable, groupBy, delay.
   **/
  onSearchSync?: (value: string) => Option[];
  onChange?: (options: Option[]) => void;
  /** Limit the maximum number of selected options. */
  maxSelected?: number;
  /** When the number of selected options exceeds the limit, the onMaxSelected will be called. */
  onMaxSelected?: (maxLimit: number) => void;
  /** Hide the placeholder when there are options selected. */
  hidePlaceholderWhenSelected?: boolean;
  disabled?: boolean;
  /** Group the options base on provided key. */
  groupBy?: string;
  className?: string;
  badgeClassName?: string;
  /**
   * First item selected is a default behavior by cmdk. That is why the default is true.
   * This is a workaround solution by add a dummy item.
   *
   * @reference: https://github.com/pacocoursey/cmdk/issues/171
   */
  selectFirstItem?: boolean;
  /** Allow user to create option when there is no option matched. */
  creatable?: boolean;
  /** Props of `Command` */
  commandProps?: React.ComponentPropsWithoutRef<typeof Command>;
  /** Props of `CommandInput` */
  inputProps?: Omit<
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>,
    "value" | "placeholder" | "disabled"
  >;
  /** hide the clear all button. */
  hideClearAllButton?: boolean;

  /** Limit how many selected badges remain visible before collapsing into a +x tooltip. */
  maxSelectedVisible?: number;

  checkbox?: boolean;
  searchFilter?: boolean;
  textInputDisabled?: boolean;

  checkboxStates?: CheckboxState[];
}

export interface MultipleSelectorRef {
  selectedValue: Option[];
  input: HTMLInputElement;
  focus: () => void;
  reset: () => void;
}

export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

function transToGroupOption(options: Option[], groupBy?: string) {
  if (options.length === 0) {
    return {};
  }
  if (!groupBy) {
    return {
      "": options,
    };
  }

  const groupOption: GroupOption = {};
  options.forEach((option) => {
    const key = (option[groupBy] as string) || "";
    if (!groupOption[key]) {
      groupOption[key] = [];
    }
    groupOption[key].push(option);
  });
  return groupOption;
}

function isOptionsExist(groupOption: GroupOption, targetOption: Option[]) {
  for (const [, value] of Object.entries(groupOption)) {
    if (value.some((option) => targetOption.find((p) => p.value === option.value))) {
      return true;
    }
  }
  return false;
}

const CommandEmpty = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const render = useCommandState((state) => state.filtered.count === 0);

  if (!render) return null;

  return (
    <div
      className={cn("px-2 py-4 text-center text-sm", className)}
      role="presentation"
      {...props}
    />
  );
};

CommandEmpty.displayName = "CommandEmpty";

const MultipleSelector = React.forwardRef<MultipleSelectorRef, MultipleSelectorProps>(
  (
    {
      value,
      onChange,
      placeholder,
      defaultOptions: arrayDefaultOptions = [],
      options: arrayOptions,
      delay,
      onSearch,
      onSearchSync,
      loadingIndicator,
      emptyIndicator,
      maxSelected = Number.MAX_SAFE_INTEGER,
      onMaxSelected,
      hidePlaceholderWhenSelected,
      disabled,
      groupBy,
      className,
      badgeClassName,
      selectFirstItem = true,
      creatable = false,
      triggerSearchOnFocus = false,
      commandProps,
      inputProps,
      hideClearAllButton = false,
      checkbox = true,
      searchFilter = false,
      maxSelectedVisible = Number.MAX_SAFE_INTEGER,
      textInputDisabled = false,
      checkboxStates,
    }: MultipleSelectorProps,
    ref: React.Ref<MultipleSelectorRef>,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [onScrollbar, setOnScrollbar] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const [selected, setSelected] = React.useState<Option[]>(value || []);
    const [options, setOptions] = React.useState<GroupOption>(
      transToGroupOption(arrayDefaultOptions, groupBy),
    );

    const [inputValue, setInputValue] = React.useState("");

    const checkboxStateMap = React.useMemo(() => {
      if (!checkboxStates) return undefined;
      return checkboxStates.reduce<Record<string, CheckboxState["state"]>>((acc, curr) => {
        acc[curr.id] = curr.state;
        return acc;
      }, {});
    }, [checkboxStates]);

    const debouncedSearchTerm = useDebounce(inputValue, delay || 500);

    const visibleSelected = React.useMemo(
      () => selected.slice(0, Math.max(0, maxSelectedVisible)),
      [selected, maxSelectedVisible],
    );

    const hiddenSelected = React.useMemo(
      () => selected.slice(Math.max(0, maxSelectedVisible)),
      [selected, maxSelectedVisible],
    );

    const showClearButton =
      !hideClearAllButton &&
      !disabled &&
      selected.length >= 1 &&
      selected.filter((s) => s.fixed).length !== selected.length;

    const rightPaddingClass =
      showClearButton && searchFilter
        ? "pe-16"
        : showClearButton || searchFilter
          ? "pe-9"
          : undefined;

    React.useImperativeHandle(
      ref,
      () => ({
        selectedValue: selected,
        input: inputRef.current as HTMLInputElement,
        focus: () => inputRef.current?.focus(),
        reset: () => {
          setSelected([]);
          onChange?.([]);
          setInputValue("");
        },
      }),
      [selected, onChange],
    );

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        inputRef.current.blur();
      }
    };

    const handleUnselect = React.useCallback(
      (option: Option) => {
        const newOptions = selected.filter((s) => s.value !== option.value);
        setSelected(newOptions);
        onChange?.(newOptions);
      },
      [onChange, selected],
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const input = inputRef.current;
        if (input) {
          if (e.key === "Delete" || e.key === "Backspace") {
            if (input.value === "" && selected.length > 0) {
              const lastSelectOption = selected[selected.length - 1];
              if (!lastSelectOption.fixed) {
                handleUnselect(selected[selected.length - 1]);
              }
            }
          }
          if (e.key === "Escape") {
            input.blur();
          }
        }
      },
      [handleUnselect, selected],
    );

    useEffect(() => {
      if (open) {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchend", handleClickOutside);
      } else {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchend", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchend", handleClickOutside);
      };
    }, [open]);

    useEffect(() => {
      if (value === undefined) {
        setSelected([]);
        setInputValue("");
        return;
      }

      setSelected(value);
    }, [value]);

    useEffect(() => {
      if (!arrayOptions || onSearch) {
        return;
      }
      const newOption = transToGroupOption(arrayOptions || [], groupBy);
      if (JSON.stringify(newOption) !== JSON.stringify(options)) {
        setOptions(newOption);
      }
    }, [arrayDefaultOptions, arrayOptions, groupBy, onSearch, options]);

    useEffect(() => {
      const doSearchSync = () => {
        const res = onSearchSync?.(debouncedSearchTerm);
        setOptions(transToGroupOption(res || [], groupBy));
      };

      const exec = async () => {
        if (!onSearchSync || !open) return;

        if (triggerSearchOnFocus) {
          doSearchSync();
        }

        if (debouncedSearchTerm) {
          doSearchSync();
        }
      };

      void exec();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchTerm, groupBy, open, triggerSearchOnFocus]);

    useEffect(() => {
      const doSearch = async () => {
        setIsLoading(true);
        const res = await onSearch?.(debouncedSearchTerm);
        setOptions(transToGroupOption(res || [], groupBy));
        setIsLoading(false);
      };

      const exec = async () => {
        if (!onSearch || !open) return;

        if (triggerSearchOnFocus) {
          await doSearch();
        }

        if (debouncedSearchTerm) {
          await doSearch();
        }
      };

      void exec();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchTerm, groupBy, open, triggerSearchOnFocus]);

    const CreatableItem = () => {
      if (!creatable) return undefined;
      if (
        isOptionsExist(options, [{ value: inputValue, label: inputValue }]) ||
        selected.find((s) => s.value === inputValue)
      ) {
        return undefined;
      }

      const Item = (
        <CommandItem
          value={inputValue}
          className="cursor-pointer"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onSelect={(value: string) => {
            if (selected.length >= maxSelected) {
              onMaxSelected?.(selected.length);
              return;
            }
            setInputValue("");
            const newOptions = [...selected, { value, label: value }];
            setSelected(newOptions);
            onChange?.(newOptions);
          }}
        >
          {`Create "${inputValue}"`}
        </CommandItem>
      );

      if (!onSearch && inputValue.length > 0) {
        return Item;
      }

      if (onSearch && debouncedSearchTerm.length > 0 && !isLoading) {
        return Item;
      }

      return undefined;
    };

    const EmptyItem = React.useCallback(() => {
      if (!emptyIndicator) return undefined;

      if (onSearch && !creatable && Object.keys(options).length === 0) {
        return (
          <CommandItem value="-" disabled>
            {emptyIndicator}
          </CommandItem>
        );
      }

      return <CommandEmpty>{emptyIndicator}</CommandEmpty>;
    }, [creatable, emptyIndicator, onSearch, options]);

    const commandFilter = React.useCallback(() => {
      if (commandProps?.filter) {
        return commandProps.filter;
      }

      if (creatable) {
        return (value: string, search: string) => {
          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : -1;
        };
      }
      return undefined;
    }, [creatable, commandProps?.filter]);

    return (
      <Command
        ref={dropdownRef}
        {...commandProps}
        onKeyDown={(e) => {
          handleKeyDown(e);
          commandProps?.onKeyDown?.(e);
        }}
        className={cn("h-auto overflow-visible bg-transparent", commandProps?.className)}
        shouldFilter={
          commandProps?.shouldFilter !== undefined ? commandProps.shouldFilter : !onSearch
        }
        filter={commandFilter()}
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
        <div
          className={cn(
            "relative min-h-[38px] rounded-md border border-input text-sm transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
            {
              "p-1": selected.length !== 0,
              "cursor-text": !disabled && selected.length !== 0,
            },
            rightPaddingClass,
            className,
          )}
          onClick={() => {
            if (disabled) return;
            inputRef?.current?.focus();
          }}
        >
          <div className="flex flex-wrap gap-1">
            {visibleSelected.map((option) => {
              return (
                <Badge
                  key={option.value}
                  className={cn(
                    "animate-fadeIn relative inline-flex h-7 cursor-default items-center rounded-md border bg-background ps-2 pe-7 pl-2 text-xs font-medium text-secondary-foreground transition-all hover:bg-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-fixed:pe-2",
                    badgeClassName,
                  )}
                  data-fixed={option.fixed}
                  data-disabled={disabled || undefined}
                >
                  <span className="truncate">{option.label}</span>
                  <button
                    className="absolute -inset-y-px -end-px flex size-7 items-center justify-center rounded-e-md border border-transparent p-0 text-muted-foreground/80 outline-hidden transition-[color,box-shadow] outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUnselect(option);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={() => handleUnselect(option)}
                    aria-label="Remove"
                  >
                    <XIcon size={14} aria-hidden="true" />
                  </button>
                </Badge>
              );
            })}
            {hiddenSelected.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge
                      className={cn(
                        "animate-fadeIn relative inline-flex h-7 cursor-help items-center rounded-md border bg-background px-2 text-xs font-medium text-secondary-foreground transition-all hover:bg-background",
                      )}
                    >
                      +{hiddenSelected.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="p-2 rounded-lg">
                    <div className="flex flex-col gap-1">
                      {hiddenSelected.map((option) => (
                        <div
                          key={option.value}
                          className={cn(
                            "animate-fadeIn relative inline-flex h-7 cursor-default items-center rounded-md border bg-background ps-2 pe-7 pl-2 text-xs font-medium text-secondary-foreground transition-all hover:bg-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-fixed:pe-2",
                            badgeClassName,
                          )}
                          data-fixed={option.fixed}
                          data-disabled={disabled || undefined}
                        >
                          <span className="truncate max-w-[160px]">{option.label}</span>
                          <button
                            className="absolute -inset-y-px -end-px flex size-7 items-center justify-center rounded-e-md border border-transparent p-0 text-muted-foreground/80 outline-hidden transition-[color,box-shadow] outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleUnselect(option);
                              }
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={() => handleUnselect(option)}
                            aria-label="Remove"
                          >
                            <XIcon size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center">
                <CommandPrimitive.Input
                  {...inputProps}
                  ref={inputRef}
                  value={inputValue}
                  readOnly={textInputDisabled}
                  disabled={disabled}
                  onValueChange={(value) => {
                    setInputValue(value);
                    inputProps?.onValueChange?.(value);
                  }}
                  onBlur={(event) => {
                    if (!onScrollbar) {
                      setOpen(false);
                    }
                    inputProps?.onBlur?.(event);
                  }}
                  onFocus={(event) => {
                    setOpen(true);
                    if (triggerSearchOnFocus) {
                      onSearch?.(debouncedSearchTerm);
                    }
                    inputProps?.onFocus?.(event);
                  }}
                  placeholder={
                    hidePlaceholderWhenSelected && selected.length !== 0 ? "" : placeholder
                  }
                  className={cn(
                    "flex-1 bg-transparent w-full outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
                    {
                      "w-full": hidePlaceholderWhenSelected,
                      "px-1 py-2": selected.length === 0,
                      "ml-1": selected.length !== 0,
                      "placeholder:text-black placeholder:text-sm placeholder:ml-0": searchFilter,
                      "cursor-pointer": searchFilter && !open,
                      "cursor-default": searchFilter && open,
                    },
                    inputProps?.className,
                  )}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelected(selected.filter((s) => s.fixed));
                onChange?.(selected.filter((s) => s.fixed));
              }}
              className={cn(
                "absolute end-0 top-0 flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground/80 transition-[color,box-shadow] outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                !showClearButton && "hidden",
              )}
              aria-label="Clear all"
            >
              <XIcon size={16} aria-hidden="true" />
            </button>
            {searchFilter && (
              <button
                type="button"
                aria-label={open ? "Collapse options" : "Expand options"}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (disabled) return;
                  setOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      inputRef?.current?.focus();
                    } else {
                      inputRef?.current?.blur();
                    }
                    return next;
                  });
                }}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-transform hover:text-foreground",
                  showClearButton ? "right-10" : "right-2",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <ChevronDown className="size-4 transition-transform" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <div
            className={cn(
              "absolute top-2 z-10 w-full overflow-hidden rounded-md border border-input",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              !open && "hidden",
            )}
            data-state={open ? "open" : "closed"}
          >
            {open && (
              <CommandList
                className="bg-popover text-popover-foreground shadow-lg outline-hidden"
                onMouseLeave={() => {
                  setOnScrollbar(false);
                }}
                onMouseEnter={() => {
                  setOnScrollbar(true);
                }}
                onMouseUp={() => {
                  inputRef?.current?.focus();
                }}
              >
                {isLoading ? (
                  <>{loadingIndicator}</>
                ) : (
                  <>
                    {EmptyItem()}
                    {CreatableItem()}
                    {!selectFirstItem && <CommandItem value="-" className="hidden" />}
                    {Object.entries(options).map(([key, dropdowns]) => (
                      <CommandGroup key={key} heading={key} className="h-full overflow-auto p-1">
                        <>
                          {dropdowns.map((option) => {
                            const isSelected = selected.some((s) => s.value === option.value);
                            const checkboxState = checkboxStateMap?.[option.value];
                            const checkedState = isSelected ? true : (checkboxState ?? false);

                            if (isSelected && !checkbox) return;

                            return (
                              <CommandItem
                                key={option.value}
                                value={option.value}
                                disabled={option.disable}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onSelect={() => {
                                  if (checkedState === true) {
                                    if (option.fixed) return;
                                    const newOptions = selected.filter(
                                      (s) => s.value !== option.value,
                                    );
                                    setSelected(newOptions);

                                    onChange?.(newOptions);
                                    return;
                                  }

                                  if (selected.length >= maxSelected) {
                                    onMaxSelected?.(selected.length);
                                    return;
                                  }

                                  setInputValue("");
                                  const newOptions = [...selected, option];
                                  setSelected(newOptions);
                                  onChange?.(newOptions);
                                }}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 pl-3",
                                  option.disable &&
                                    "pointer-events-none cursor-not-allowed opacity-50",
                                )}
                              >
                                {checkbox && (
                                  <Checkbox
                                    checked={checkedState}
                                    className="pointer-events-none"
                                  />
                                )}
                                <span className="flex-1 truncate">{option.label}</span>
                              </CommandItem>
                            );
                          })}
                        </>
                      </CommandGroup>
                    ))}
                  </>
                )}
              </CommandList>
            )}
          </div>
        </div>
      </Command>
    );
  },
);

MultipleSelector.displayName = "MultipleSelector";
export default MultipleSelector;
