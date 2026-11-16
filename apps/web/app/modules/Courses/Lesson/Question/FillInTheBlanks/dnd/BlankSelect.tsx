import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

export type BlankSelectItem = { key: string; label: string };

type BlankSelectProps = {
  blankId: string;
  label: string;
  selectedKey: string | null;
  items: BlankSelectItem[];
  onSelect: (key: string | null) => void;
  placeholder?: string;
  minWidth?: string;
  wrapText?: boolean;
};

// Radix forbids an empty-string item value, so clearing a blank uses a sentinel.
const CLEAR_VALUE = "__blank_clear__";

export const BlankSelect = ({
  blankId,
  label,
  selectedKey,
  items,
  onSelect,
  placeholder,
  minWidth,
  wrapText,
}: BlankSelectProps) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: blankId, data: { blankId } });

  // Radix resolves the trigger text from mounted items; the list is portalled and only mounts on
  // open, so a pre-filled value stays blank until opened. Render the label ourselves to avoid that.
  const selectedLabel = items.find(({ key }) => key === selectedKey)?.label;

  // aria-label overrides the trigger's inner text, so fold the chosen word into the name; otherwise
  // a screen reader would announce the blank number but never the selected word.
  const accessibleName = selectedLabel ? `${label}, ${selectedLabel}` : label;

  const handleValueChange = (value: string) => onSelect(value === CLEAR_VALUE ? null : value);

  return (
    <span
      ref={setNodeRef}
      data-testid={blankId}
      style={minWidth ? { minWidth } : undefined}
      className={cn("mx-2 inline-flex max-w-full align-middle", wrapText && "mx-0 w-full")}
    >
      <Select value={selectedKey ?? ""} onValueChange={handleValueChange}>
        <SelectTrigger
          aria-label={accessibleName}
          className={cn(
            "h-9 w-full min-w-0 rounded-md px-2 py-1 text-sm",
            wrapText && "h-auto min-h-9",
            isOver && "ring-2 ring-primary-400",
          )}
        >
          <SelectValue placeholder={placeholder ?? label}>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {selectedKey && (
            <SelectItem value={CLEAR_VALUE}>{t("studentLessonView.other.removeWord")}</SelectItem>
          )}
          {items.map(({ key, label: itemLabel }) => (
            <SelectItem key={key} value={key}>
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
};
