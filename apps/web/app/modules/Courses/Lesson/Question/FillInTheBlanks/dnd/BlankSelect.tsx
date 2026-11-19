import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type PointerEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { LEARNING_HANDLES } from "../../../../../../../e2e/data/learning/handles";

export type BlankSelectItem = { key: string; label: string };

type BlankSelectProps = {
  blankId: string;
  testId: string;
  label: string;
  selectedKey: string | null;
  items: BlankSelectItem[];
  onSelect: (key: string | null) => void;
  /** Drag id of the word in this blank; when set, the word can be dragged out like a bank word. */
  dragId?: string;
  minWidth?: string;
  wrapText?: boolean;
};

// Pointer travel before a drag starts, so a click on a filled blank opens its list instead.
export const DRAG_ACTIVATION_DISTANCE = 4;

// Radix forbids an empty-string item value, so clearing a blank uses a sentinel.
const CLEAR_VALUE = "__blank_clear__";

export const BlankSelect = ({
  blankId,
  testId,
  label,
  selectedKey,
  items,
  onSelect,
  dragId,
  minWidth,
  wrapText,
}: BlankSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const openOnReleaseRef = useRef(false);
  const { setNodeRef, isOver } = useDroppable({ id: blankId, data: { blankId } });
  const {
    listeners,
    setNodeRef: setDragNodeRef,
    isDragging,
  } = useDraggable({
    id: dragId ?? `${blankId}:empty`,
    data: { blankId },
    disabled: !dragId,
  });

  // Radix resolves the trigger text from mounted items; the list is portalled and only mounts on
  // open, so a pre-filled value stays blank until opened. Render the label ourselves to avoid that.
  const selectedLabel = items.find(({ key }) => key === selectedKey)?.label;

  // aria-label overrides the trigger's inner text, so fold the chosen word into the name; otherwise
  // a screen reader would announce the blank number but never the selected word.
  const accessibleName = selectedLabel ? `${label}, ${selectedLabel}` : label;

  const handleValueChange = (value: string) => onSelect(value === CLEAR_VALUE ? null : value);

  // Radix opens the list on mouse pointerdown, which would swallow the drag of a placed word. Hand
  // pointerdown to dnd-kit instead and open the list on release unless a drag started; touch and
  // keyboard keep Radix's own handling.
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    openOnReleaseRef.current = false;

    if (!dragId) return;

    listeners?.onPointerDown?.(event);

    if (event.pointerType === "mouse") {
      event.preventDefault();
      openOnReleaseRef.current = true;
    }
  };

  const handlePointerUp = () => {
    if (openOnReleaseRef.current && !isDragging) setIsOpen(true);

    openOnReleaseRef.current = false;
  };

  return (
    <span
      ref={setNodeRef}
      data-testid={testId}
      style={minWidth ? { minWidth } : undefined}
      className={cn("mx-2 inline-flex max-w-full align-middle", wrapText && "mx-0 w-full")}
    >
      <Select
        value={selectedKey ?? ""}
        onValueChange={handleValueChange}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger
          ref={setDragNodeRef}
          data-testid={LEARNING_HANDLES.BLANK_SELECT_TRIGGER}
          aria-label={accessibleName}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className={cn(
            // No chevron or placeholder so it reads as a blank, not a dropdown; the border alone marks the
            // control, so neutral-600 keeps it at 3:1 (WCAG 1.4.11).
            "h-9 w-full min-w-0 rounded-md border-neutral-600 px-2 py-1 text-sm [&>svg]:hidden",
            wrapText && "h-auto min-h-9",
            dragId && "cursor-grab",
            isOver && "ring-2 ring-primary-400",
          )}
        >
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {selectedKey && (
            <SelectItem value={CLEAR_VALUE}>{t("studentLessonView.other.removeWord")}</SelectItem>
          )}
          {items.map(({ key, label: itemLabel }) => (
            <SelectItem
              key={key}
              value={key}
              data-testid={LEARNING_HANDLES.blankSelectOption(itemLabel)}
            >
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
};
