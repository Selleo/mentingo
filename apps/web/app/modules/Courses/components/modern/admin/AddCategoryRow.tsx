import { Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateCategory } from "~/api/mutations/admin/useCreateCategory";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../../../e2e/data/courses/handles";

import type { FormEvent, KeyboardEvent } from "react";

type AddCategoryRowProps = {
  onCreated: (category: { id: string; title: string }) => void;
};

export function AddCategoryRow({ onCreated }: AddCategoryRowProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const isCancellingRef = useRef(false);

  const { mutate: createCategory, isPending } = useCreateCategory();

  useEffect(() => {
    if (!isEditing) return;

    isCancellingRef.current = false;
    inputRef.current?.focus();
  }, [isEditing]);

  const handleCancel = () => {
    setIsEditing(false);
    setTitle("");
  };

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const trimmedTitle = title.trim();
    if (isPending || isCancellingRef.current) return;
    if (!trimmedTitle) return handleCancel();

    createCategory(
      { data: { title: trimmedTitle, language } },
      {
        onSuccess: ({ data }) => {
          onCreated({ id: data.id, title: trimmedTitle });
          handleCancel();
        },
      },
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;

    isCancellingRef.current = true;
    handleCancel();
  };

  return (
    <section className="pb-6">
      <div className="flex items-center gap-3 px-4 md:px-8">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="flex w-full max-w-2xl items-center gap-3">
            <input
              ref={inputRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => handleSubmit()}
              disabled={isPending}
              placeholder={t("studentCoursesView.modernView.inlineEdit.categoryPlaceholder")}
              className="h2 w-full border-b-2 border-dashed border-primary-400 bg-transparent text-2xl leading-snug outline-none placeholder:text-neutral-300 md:text-[32px] md:leading-relaxed"
              data-testid={COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY_INPUT}
            />
            {isPending && <Loader2 className="size-5 shrink-0 animate-spin text-primary-700" />}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="h2 flex items-center gap-3 text-2xl leading-snug text-neutral-300 transition-colors hover:text-primary-700 focus-visible:text-primary-700 focus-visible:outline-none md:text-[32px] md:leading-relaxed"
            data-testid={COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY}
          >
            <Plus className="size-7" aria-hidden="true" />
            {t("studentCoursesView.modernView.inlineEdit.addCategory")}
          </button>
        )}
      </div>
    </section>
  );
}
