import { useEffect, useState } from "react";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import type React from "react";

type EditableTextProps = {
  value: string;
  fallback: string;
  canEdit: boolean;
  className?: string;
  inputClassName?: string;
  onEditingChange?: (isEditing: boolean) => void;
  onSave: (value: string) => Promise<void>;
};

export type LearningPathEditableTextProps = EditableTextProps;

export const LearningPathEditableText = ({
  value,
  fallback,
  canEdit,
  className,
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

  const cancel = () => {
    setDraftValue(value);
    setIsEditing(false);
  };

  if (!canEdit || !isEditing) {
    return (
      <button
        type="button"
        className={cn(
          "block w-full text-left",
          canEdit &&
            "rounded-xl border-[1.5px] border-dashed border-transparent px-3 py-2 transition hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus-visible:border-primary-300 focus-visible:ring-2 focus-visible:ring-primary-300",
          className,
        )}
        disabled={!canEdit}
        onClick={() => canEdit && setIsEditing(true)}
      >
        {canEdit ? (
          <span className="inline-flex max-w-full align-top">
            <span className="min-w-0 truncate">{value || fallback}</span>
          </span>
        ) : (
          value || fallback
        )}
      </button>
    );
  }

  const sharedProps = {
    value: draftValue,
    autoFocus: true,
    className: cn("h-auto rounded-xl border-[1.5px] border-primary-300 px-3 py-2", inputClassName),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraftValue(event.target.value),
    onBlur: save,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void save();
      }
    },
  };

  return <Input {...sharedProps} />;
};
