import { Minus, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

import type React from "react";

type UpdateAiAvatarModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPreview: string | null;
  accept: string;
  onSave: (data: { file: File | null; remove: boolean }) => void;
  onCancel: () => void;
};

const UpdateAiAvatarModal = ({
  open,
  onOpenChange,
  currentPreview,
  accept,
  onSave,
  onCancel,
}: UpdateAiAvatarModalProps) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPreview, setDraftPreview] = useState<string | null>(currentPreview);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) return;
    revokeObjectUrl();
    setDraftFile(null);
    setDraftPreview(currentPreview);
    setRemoveAvatar(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [open, currentPreview]);

  useEffect(() => () => revokeObjectUrl(), []);

  const applyFile = (file: File | null) => {
    revokeObjectUrl();
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setDraftPreview(objectUrl);
      setDraftFile(file);
      setRemoveAvatar(false);
    } else {
      setDraftPreview(currentPreview);
      setDraftFile(null);
    }
  };

  const handleDrag = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragleave") setIsDragging(true);
    if (event.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    applyFile(file ?? null);
  };

  const handleRemove = () => {
    revokeObjectUrl();
    setDraftPreview(null);
    setDraftFile(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
    onSave({ file: removeAvatar ? null : draftFile, remove: removeAvatar });
    onOpenChange(false);
  };

  const handleCancel = () => {
    revokeObjectUrl();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("adminCourseView.curriculum.lesson.other.updateAiMentorAvatar")}
          </DialogTitle>
          <DialogDescription>
            {t("adminCourseView.curriculum.lesson.other.updateAiMentorAvatarDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-4">
            {draftPreview && (
              <div className="relative">
                <Avatar className="size-32 overflow-hidden border shadow-sm">
                  <AvatarImage src={draftPreview} />
                  <AvatarFallback>
                    <Icon name="AiMentor" className="size-12 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  size="icon"
                  onClick={handleRemove}
                  className="absolute left-0 bottom-0 text-contrast bg-primary size-8 rounded-full shadow-md"
                  title={t("common.button.delete")}
                >
                  <Minus className="size-8" />
                </Button>
              </div>
            )}

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) =>
                (event.key === "Enter" || event.key === " ") && fileInputRef.current?.click()
              }
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-neutral-50 px-6 py-10 text-center transition",
                {
                  "border-primary bg-primary/5": isDragging,
                  "border-neutral-200 hover:border-primary hover:bg-primary/5": !isDragging,
                },
              )}
            >
              <UploadCloud className="mb-2 size-6 text-neutral-500 transition group-hover:text-primary" />
              <p className="text-sm font-semibold text-neutral-800 group-hover:text-primary">
                {t("adminCourseView.curriculum.lesson.other.dropOrClick")}
              </p>
              <p className="text-xs text-neutral-500">
                {t("adminCourseView.curriculum.lesson.other.allowedFormats")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(event) => applyFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" type="button" onClick={handleCancel}>
            {t("common.button.cancel")}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t("common.button.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateAiAvatarModal;
