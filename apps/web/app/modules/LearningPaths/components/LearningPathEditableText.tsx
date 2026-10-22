import { useEffect, useState } from "react";
import { match } from "ts-pattern";

import { AutosizeTextarea } from "~/components/ui/autosize-textarea";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import type React from "react";

type EditableTextProps = {
  value: string;
  fallback: string;
  canEdit: boolean;
  multiline?: boolean;
  wrap?: boolean;
  testId?: string;
  className?: string;
  displayTextClassName?: string;
  inputClassName?: string;
  onEditingChange?: (isEditing: boolean) => void;
  onSave: (value: string) => Promise<void>;
};

export type LearningPathEditableTextProps = EditableTextProps;

export const LearningPathEditableText = ({
  value,
  fallback,
  canEdit,
  multiline = false,
  wrap = multiline,
  testId,
  className,
  displayTextClassName,
  inputClassName,
  onEditingChange,
  onSave,
}: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (!isEditing) setDraftValue(value);
  }, [isEditing, value]);

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  const save = async () => {
    const normalizedValue = draftValue.trim();
    setIsEditing(false);
    if (normalizedValue === value.trim()) return;
    await onSave(normalizedValue);
  };

  const textLayoutClassName = cn(
    match({ multiline, wrap })
      .with({ multiline: true }, () => "whitespace-pre-wrap break-words")
      .with({ wrap: true }, () => "whitespace-normal break-words")
      .otherwise(() => "truncate"),
    displayTextClassName,
  );

  const cancel = () => {
    setDraftValue(value);
    setIsEditing(false);
  };

  if (!canEdit) {
    return (
      <span className={cn("block", className)} data-testid={testId}>
        <span className={textLayoutClassName}>{value || fallback}</span>
      </span>
    );
  }

  if (!isEditing) {
    return (
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-auto w-full justify-start whitespace-normal rounded-xl border-[1.5px] border-dashed border-transparent px-3 py-2 text-left hover:border-primary-300 hover:bg-primary-50 focus-visible:border-primary-300 focus-visible:ring-primary-300",
          className,
        )}
        onClick={() => setIsEditing(true)}
        data-testid={testId}
      >
        <span className="inline-flex max-w-full align-top">
          <span className={cn("min-w-0", textLayoutClassName)}>{value || fallback}</span>
        </span>
      </Button>
    );
  }

  const sharedProps = {
    value: draftValue,
    autoFocus: true,
    "data-testid": testId && `${testId}-input`,
    className: cn(
      "!mt-0 h-auto min-h-0 rounded-xl border-[1.5px] border-primary-300 bg-white px-3 py-2",
      className,
      inputClassName,
    ),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraftValue(event.target.value),
    onBlur: save,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
      if (event.key === "Enter" && !(multiline && event.shiftKey)) {
        event.preventDefault();
        void save();
      }
    },
  };

  if (wrap) return <AutosizeTextarea {...sharedProps} minRows={1} maxRows={10} />;

  return <Input {...sharedProps} />;
};
