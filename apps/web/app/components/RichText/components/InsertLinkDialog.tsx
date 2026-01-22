import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import type { Editor } from "@tiptap/react";
import type i18n from "i18n";

interface LinkDialogProps {
  open: boolean;
  onClose: () => void;
  editor: Editor;
}

const insertUrlSchema = (t: typeof i18n.t) =>
  z.object({
    url: z
      .string()
      .url(t("richTextEditor.toolbar.link.dialog.urlInvalid"))
      .min(1, t("richTextEditor.toolbar.link.dialog.urlRequired")),
    text: z.string().min(1, t("richTextEditor.toolbar.link.dialog.linkTextRequired")),
  });

type InsertLinkFormValues = z.infer<ReturnType<typeof insertUrlSchema>>;

export const InsertLinkDialog = ({ open, onClose, editor }: LinkDialogProps) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InsertLinkFormValues>({
    resolver: zodResolver(insertUrlSchema(t)),
    defaultValues: {
      url: "",
      text: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        url: editor.getAttributes("link")?.href || "",
        text: editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to,
          " ",
        ),
      });
    }
  }, [open, editor, reset]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    handleSubmit(({ url, text }: InsertLinkFormValues) => {
      const { from, to } = editor.state.selection;

      if (text && editor.state.doc.textBetween(from, to, " ") !== text) {
        editor
          .chain()
          .focus()
          .insertContent(text)
          .setTextSelection({ from, to: from + text.length })
          .setLink({ href: url })
          .run();
      } else {
        editor.chain().focus().setLink({ href: url }).run();
      }

      onClose();
    })(event);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle className="mb-2">{t("richTextEditor.toolbar.link.dialog.title")}</DialogTitle>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="link-url">{t("richTextEditor.toolbar.link.dialog.urlLabel")}</Label>
            <Input id="link-url" placeholder="https://example.com" {...register("url")} />
            {errors.url?.message && (
              <span className="text-xs text-red-500">{errors.url.message}</span>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-text">
              {t("richTextEditor.toolbar.link.dialog.linkTextLabel")}
            </Label>
            <Input
              id="link-text"
              placeholder={t("richTextEditor.toolbar.link.dialog.linkTextPlaceholder")}
              {...register("text")}
            />
            {errors.text?.message && (
              <span className="text-xs text-red-500">{errors.text.message}</span>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" type="submit">
              {t("common.button.save")}
            </Button>
            <Button
              size="sm"
              type="button"
              className="border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
              onClick={onClose}
            >
              {t("common.button.cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
