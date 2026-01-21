import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import useUpdateLoginPageFiles from "~/api/mutations/admin/useUpdateLoginPageFiles";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import {
  uploadLoginPageFileDialogSchema,
  type UploadLoginPageFileDialogValues,
} from "./UploadFilesToLoginPage.schema";

interface UploadFilesToLoginPageDialogProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
}

export const UploadFilesToLoginPageDialog = ({
  open,
  file,
  onClose,
}: UploadFilesToLoginPageDialogProps) => {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const { mutateAsync: uploadFiles, isPending } = useUpdateLoginPageFiles();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UploadLoginPageFileDialogValues>({
    resolver: zodResolver(uploadLoginPageFileDialogSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (open && file) {
      reset({ name: file.name });
    }
  }, [file, open, reset]);

  const onSubmit = async (data: UploadLoginPageFileDialogValues) => {
    if (!file) return;

    await uploadFiles({
      file,
      name: data.name,
      language,
    });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("loginFilesUpload.header")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-page-file-name">{t("loginFilesUpload.fileName.label")}</Label>
            <Input
              id="login-page-file-name"
              placeholder={t("loginFilesUpload.fileName.placeholder")}
              {...register("name", { required: true })}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !file}>
              {isPending ? t("common.button.saving") : t("common.button.save")}
            </Button>
            <Button
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
