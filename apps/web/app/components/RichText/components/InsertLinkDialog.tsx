import { useState, useEffect } from "react";
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

export const InsertLinkDialog = ({ open, onClose, editor }: LinkDialogProps) => {
  const { t } = useTranslation();

  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState({
    url: "",
    text: "",
  });

  useEffect(() => {
    if (open) {
      setUrl(editor.getAttributes("link")?.href || "");
      setText(
        editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " "),
      );
      setErrors({
        url: "",
        text: "",
      });
    }
  }, [open, editor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parseResult = insertUrlSchema(t).safeParse({ url, text });

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      setErrors({
        url: fieldErrors.url?.[0] || "",
        text: fieldErrors.text?.[0] || "",
      });

      return;
    }

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
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle className="mb-2">{t("richTextEditor.toolbar.link.dialog.title")}</DialogTitle>
        <div className="space-y-1">
          <Label htmlFor="link-url">{t("richTextEditor.toolbar.link.dialog.urlLabel")}</Label>
          <Input
            id="link-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />
          {errors.url && <span className="text-xs text-red-500">{errors.url}</span>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="link-text">{t("richTextEditor.toolbar.link.dialog.linkTextLabel")}</Label>
          <Input
            id="link-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("richTextEditor.toolbar.link.dialog.linkTextPlaceholder")}
          />
          {errors.text && <span className="text-xs text-red-500">{errors.text}</span>}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleSubmit}>
            {t("common.button.save")}
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.button.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
