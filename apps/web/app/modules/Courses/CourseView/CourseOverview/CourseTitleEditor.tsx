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
  if (isEditing) {
    return (
      <textarea
        value={title}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onBlur={() => {
          void onSave();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
        className="mb-4 w-full resize-none rounded-lg border-2 border-primary-700 bg-white/95 px-2 py-1 text-2xl font-bold leading-tight text-neutral-950 md:text-3xl lg:text-4xl"
        rows={2}
      />
    );
  }

  return (
    <h1 className="mb-4 text-xl font-bold leading-snug text-white md:text-3xl md:leading-tight lg:text-4xl">
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
