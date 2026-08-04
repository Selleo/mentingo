import { Pencil } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  COURSE_OVERVIEW_HANDLES,
  COURSE_SETTINGS_HANDLES,
} from "../../../../../e2e/data/courses/handles";

import type { ReactNode } from "react";

type CourseTitleEditorProps = {
  canEdit: boolean;
  disabled: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onChange: (title: string) => void;
  onEdit: () => void;
  onSave: () => Promise<void>;
  placeholder: string;
  title: string;
};

export default function CourseTitleEditor({
  canEdit,
  disabled,
  isEditing,
  onCancel,
  onChange,
  onEdit,
  onSave,
  placeholder,
  title,
}: CourseTitleEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const titleEnd = textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(titleEnd, titleEnd);
  }, [isEditing]);

  let titleContent: ReactNode = title;

  if (isEditing) {
    titleContent = (
      <span className="grid w-full">
        <span
          aria-hidden
          className="invisible col-start-1 row-start-1 whitespace-pre-wrap break-words border-2 p-2"
        >
          {title || placeholder}
        </span>
        <textarea
          ref={textareaRef}
          data-testid={COURSE_SETTINGS_HANDLES.TITLE_INPUT}
          placeholder={placeholder}
          value={title}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            onSave();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
              return;
            }

            if (event.key === "Escape") {
              onCancel();
            }
          }}
          className="col-start-1 row-start-1 block size-full resize-none overflow-hidden rounded-lg border-2 border-transparent bg-transparent p-2 text-left backdrop-blur-lg placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white"
          rows={1}
        />
      </span>
    );
  } else if (canEdit) {
    titleContent = (
      <button
        type="button"
        data-testid={COURSE_SETTINGS_HANDLES.TITLE_INPUT}
        onClick={onEdit}
        className="group/title-edit inline-block max-w-full rounded-lg border-2 border-dashed border-transparent p-2 text-left transition-colors duration-200 hover:border-white focus-visible:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <span className="break-words">
          {title ? title : <span className="text-neutral-200">{placeholder}</span>}
          <Pencil
            aria-hidden
            className="relative -top-0.5 ml-2 inline-block size-4 align-middle text-white/80 opacity-0 transition-all duration-200 group-hover/title-edit:translate-x-0.5 group-hover/title-edit:opacity-100 group-focus-visible/title-edit:translate-x-0.5 group-focus-visible/title-edit:opacity-100 md:size-5"
          />
        </span>
      </button>
    );
  }

  return (
    <h1
      data-testid={COURSE_OVERVIEW_HANDLES.HERO_TITLE}
      className="relative z-10 mb-4 min-w-0 max-w-full text-lg font-bold leading-snug text-white min-[360px]:text-xl md:text-3xl md:leading-tight lg:text-4xl"
    >
      {titleContent}
    </h1>
  );
}
