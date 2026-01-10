import { zodResolver } from "@hookform/resolvers/zod";
import { EXTERNAL_RESOURCE_TYPE } from "@repo/shared";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "~/components/ui/dialog";
import { FormField } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { Editor } from "@tiptap/react";
import type i18n from "i18n";

interface LinkDialogProps {
  open: boolean;
  onClose: () => void;
  editor: Editor;
}

const insertExternalResourceSchema = (t: typeof i18n.t) =>
  z.object({
    url: z
      .string()
      .url(t("richTextEditor.toolbar.link.dialog.urlInvalid"))
      .min(1, t("richTextEditor.toolbar.link.dialog.urlRequired")),
    type: z.nativeEnum(EXTERNAL_RESOURCE_TYPE),
  });

type InsertExternalResourceFormValues = z.infer<ReturnType<typeof insertExternalResourceSchema>>;

export const InsertExternalResourceDialog = ({ open, onClose, editor }: LinkDialogProps) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<InsertExternalResourceFormValues>({
    resolver: zodResolver(insertExternalResourceSchema(t)),
    defaultValues: {
      url: "",
      type: EXTERNAL_RESOURCE_TYPE.PRESENTATION,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        url: "",
        type: EXTERNAL_RESOURCE_TYPE.PRESENTATION,
      });
    }
  }, [open, editor, reset]);

  const onSubmit = ({ url, type }: InsertExternalResourceFormValues) => {
    if (url) {
      if (type === EXTERNAL_RESOURCE_TYPE.VIDEO) {
        editor.chain().focus().setVideoEmbed({ src: url, sourceType: "external" }).run();
      } else if (type === EXTERNAL_RESOURCE_TYPE.PRESENTATION) {
        editor.chain().focus().setPresentationEmbed({ src: url, sourceType: "external" }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}" data-type="${type}">${url}</a>`)
          .run();
      }
    }
    onClose();
  };

  const handleFormSubmit = handleSubmit(onSubmit);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle className="mb-2">
          {t("richTextEditor.toolbar.externalResource.title")}
        </DialogTitle>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleFormSubmit(event);
          }}
        >
          <div className="space-y-1">
            <FormField
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(EXTERNAL_RESOURCE_TYPE).map((resource) => (
                      <SelectItem key={resource} value={resource}>
                        {t(`richTextEditor.toolbar.externalResource.${resource}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="link-url">{t("richTextEditor.toolbar.link.dialog.urlLabel")}</Label>
            <Input id="link-url" placeholder="https://example.com" {...register("url")} />
            {errors.url?.message && (
              <span className="text-xs text-red-500">{errors.url.message}</span>
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
