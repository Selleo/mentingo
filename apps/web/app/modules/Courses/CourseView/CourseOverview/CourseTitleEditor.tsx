import { useEffect, useRef } from "react";

type CourseTitleEditorProps = {
  canEdit: boolean;
  disabled: boolean;
  isEditing: boolean;
  onCancel: () => void;
  onChange: (title: string) => void;
  onEdit: () => void;
  onSave: () => Promise<void>;
  title: string;
};

const resizeTextareaToContent = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
};

export default function CourseTitleEditor({
  canEdit,
  disabled,
  isEditing,
  onCancel,
  onChange,
  onEdit,
  onSave,
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

  useEffect(() => {
    if (!isEditing || !textareaRef.current) return;

    resizeTextareaToContent(textareaRef.current);
  }, [isEditing, title]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={title}
        disabled={disabled}
        onChange={(event) => {
          resizeTextareaToContent(event.currentTarget);
          onChange(event.target.value);
        }}
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
        className="relative z-10 mb-4 w-full resize-none overflow-hidden rounded-lg border-2 border-white bg-transparent px-2 py-3 text-2xl font-bold leading-tight text-white backdrop-blur-lg md:text-3xl lg:text-4xl"
        rows={1}
      />
    );
  }

  return (
    <h1 className="relative z-10 mb-4 text-xl font-bold leading-snug text-white md:text-3xl md:leading-tight lg:text-4xl">
      {canEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="w-full rounded-lg border-2 border-dashed border-transparent p-2 text-left transition-colors duration-200 hover:border-white hover:bg-white/10 focus-visible:border-white focus-visible:bg-primary-700"
        >
          {title}
        </button>
      ) : (
        title
      )}
    </h1>
  );
}
