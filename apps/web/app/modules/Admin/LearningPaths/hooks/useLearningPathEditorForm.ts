import { zodResolver } from "@hookform/resolvers/zod";
import {
  ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES,
  LEARNING_PATH_STATUSES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useToast } from "~/components/ui/use-toast";

import type { LearningPathEditorFormValues, LearningPathEditorLearningPath } from "../types";

const learningPathEditorSchema = z.object({
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
  title: z.string().min(1),
  description: z.string(),
  thumbnailReference: z.string().nullable().optional(),
  thumbnail: z.custom<File>().nullable().optional(),
  certificateSignature: z.custom<File>().nullable().optional(),
  removeCertificateSignature: z.boolean().optional(),
  certificateFontColor: z.string().nullable().optional(),
  status: z.nativeEnum(LEARNING_PATH_STATUSES),
  includesCertificate: z.boolean(),
  sequenceEnabled: z.boolean(),
});

type UseLearningPathEditorFormParams = {
  learningPath: LearningPathEditorLearningPath | null;
  isCreateMode: boolean;
  editorLanguage: SupportedLanguages;
};

export function useLearningPathEditorForm({
  learningPath,
  isCreateMode,
  editorLanguage,
}: UseLearningPathEditorFormParams) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [displayThumbnailUrl, setDisplayThumbnailUrl] = useState<string | null>(null);
  const [displayCertificateSignatureUrl, setDisplayCertificateSignatureUrl] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const certificateSignatureInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<LearningPathEditorFormValues>({
    resolver: zodResolver(learningPathEditorSchema),
    mode: "onChange",
    defaultValues: {
      language: editorLanguage,
      title: "",
      description: "",
      thumbnailReference: null,
      thumbnail: null,
      certificateSignature: null,
      removeCertificateSignature: false,
      certificateFontColor: null,
      status: LEARNING_PATH_STATUSES.DRAFT,
      includesCertificate: false,
      sequenceEnabled: false,
    },
  });

  useEffect(() => {
    form.setValue("language", editorLanguage, { shouldValidate: true });
  }, [editorLanguage, form]);

  useEffect(() => {
    if (!learningPath || isCreateMode) return;

    form.reset({
      language: editorLanguage,
      title: learningPath.title,
      description: learningPath.description,
      thumbnailReference: learningPath.thumbnailReference,
      thumbnail: null,
      certificateSignature: null,
      removeCertificateSignature: false,
      certificateFontColor: learningPath.settings.certificateFontColor ?? null,
      status: learningPath.status ?? LEARNING_PATH_STATUSES.DRAFT,
      includesCertificate: learningPath.includesCertificate ?? false,
      sequenceEnabled: learningPath.sequenceEnabled ?? false,
    });
    setDisplayThumbnailUrl(learningPath.thumbnailReference ?? null);
    setDisplayCertificateSignatureUrl(learningPath.settings.certificateSignatureUrl ?? null);
  }, [editorLanguage, form, isCreateMode, learningPath]);

  const handleImageUpload = (file: File) => {
    form.setValue("thumbnail", file, { shouldValidate: true });
    setDisplayThumbnailUrl(URL.createObjectURL(file));
  };

  const handleCertificateSignatureUpload = (file: File) => {
    if (!(ALLOWED_CERTIFICATE_SIGNATURE_FILE_TYPES as readonly string[]).includes(file.type)) {
      toast({
        variant: "destructive",
        description: t("adminCourseView.toast.certificateUpdateError"),
      });
      return;
    }

    form.setValue("certificateSignature", file, { shouldValidate: true });
    form.setValue("removeCertificateSignature", false, { shouldValidate: true });
    setDisplayCertificateSignatureUrl(URL.createObjectURL(file));
  };

  const removeThumbnail = () => {
    form.setValue("thumbnailReference", null, { shouldValidate: true });
    form.setValue("thumbnail", null, { shouldValidate: true });
    setDisplayThumbnailUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeCertificateSignature = () => {
    form.setValue("certificateSignature", null, { shouldValidate: true });
    form.setValue("removeCertificateSignature", true, { shouldValidate: true });
    setDisplayCertificateSignatureUrl(null);

    if (certificateSignatureInputRef.current) {
      certificateSignatureInputRef.current.value = "";
    }
  };

  return {
    form,
    displayThumbnailUrl,
    displayCertificateSignatureUrl,
    fileInputRef,
    certificateSignatureInputRef,
    handleImageUpload,
    handleCertificateSignatureUpload,
    removeThumbnail,
    removeCertificateSignature,
  };
}
