import { Editor as MailyEditor } from "@maily-to/core";
import {
  button,
  columns,
  divider,
  footer,
  heading1,
  heading2,
  heading3,
  image,
  section,
  spacer,
  text,
} from "@maily-to/core/blocks";
import { ImageUploadExtension } from "@maily-to/core/extensions";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES } from "@repo/shared";
import { AxiosError } from "axios";
import { PanelTop } from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { ApiClient } from "~/api/api-client";
import { toast } from "~/components/ui/use-toast";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";

import { ButtonFallbackExtension } from "../../tiptap/button-fallback";
import { DisableMailyVariableExtension } from "../../tiptap/disable-maily-variable";
import { buildTranslatedPlaceholder } from "../../tiptap/localized-placeholder";
import { useMailyEditorStyles } from "../../tiptap/maily-styles";
import { UuidExtension, stampContent } from "../../tiptap/uuid-extension";
import { VariableHighlightExtension } from "../../tiptap/variable-highlight";
import { applyStructuralChangesToBase } from "../../utils/applyStructuralChangesToBase";
import { collectBasePlaceholders } from "../../utils/collectBasePlaceholders";
import { extractStringsFromDoc } from "../../utils/extractStringsFromDoc";
import { flattenForLanguage } from "../../utils/flattenForLanguage";
import {
  insertLogoHeader,
  packTenantLogoInDoc,
  resolveTenantLogoInDoc,
} from "../../utils/logoHeader";

import type { BlockGroupItem, BlockItem } from "@maily-to/core/blocks";
import type {
  EmailTemplateBlocks,
  EmailTemplateStrings,
  SupportedLanguages,
  TranslationFragment,
} from "@repo/shared";
import type { Editor } from "@tiptap/core";
import type { TFunction } from "i18next";

type EmailTemplateEditorProps = {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  onBlocksChange: (blocks: EmailTemplateBlocks) => void;
  onStringsChange: (nextForLanguage: Record<string, TranslationFragment>) => void;
};

const translateBlock = (t: TFunction, block: BlockItem, key: string): BlockItem => ({
  ...block,
  title: t(`emailTemplates.builder.blocks.${key}.title`),
  description: t(`emailTemplates.builder.blocks.${key}.description`),
});

const buildBlocks = (t: TFunction, tenantLogoUrl: string | null): BlockGroupItem[] => {
  const logoHeader: BlockItem = {
    title: t("emailTemplates.builder.blocks.logoHeader.title"),
    description: t("emailTemplates.builder.blocks.logoHeader.description"),
    searchTerms: ["logo", "header", "brand", "tenant"],
    icon: <PanelTop className="mly:h-4 mly:w-4" />,
    command: insertLogoHeader(tenantLogoUrl),
  };

  return [
    {
      title: t("emailTemplates.builder.blocks.groups.text"),
      commands: [
        translateBlock(t, text, "text"),
        translateBlock(t, heading1, "heading1"),
        translateBlock(t, heading2, "heading2"),
        translateBlock(t, heading3, "heading3"),
      ],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.media"),
      commands: [translateBlock(t, image, "image"), logoHeader],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.structure"),
      commands: [
        translateBlock(t, section, "section"),
        translateBlock(t, columns, "columns"),
        translateBlock(t, divider, "divider"),
        translateBlock(t, spacer, "spacer"),
      ],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.interactive"),
      commands: [translateBlock(t, button, "button")],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.footer"),
      commands: [translateBlock(t, footer, "footer")],
    },
  ];
};

export const EmailTemplateEditor = ({
  blocks,
  strings,
  language,
  baseLanguage,
  onBlocksChange,
  onStringsChange,
}: EmailTemplateEditorProps) => {
  const { t } = useTranslation();
  useMailyEditorStyles();
  const { data: tenantLogoUrl } = usePlatformLogo();
  const logoUrl = tenantLogoUrl ?? null;
  const isBase = language === baseLanguage;

  const basePlaceholdersRef = useRef<Record<string, string>>({});
  basePlaceholdersRef.current = useMemo(() => collectBasePlaceholders(blocks), [blocks]);

  const initialContent = useMemo(
    () => {
      const stamped = stampContent(blocks as never) as EmailTemplateBlocks;
      const flattened = flattenForLanguage({
        blocks: stamped,
        strings,
        language,
        baseLanguage,
      });
      return resolveTenantLogoInDoc(flattened, logoUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  const blockPalette = useMemo(() => buildBlocks(t, logoUrl), [t, logoUrl]);

  const editorExtensions = useMemo(() => {
    const uploadEmailTemplateImage = async (file: Blob): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file, "email-template-image");

      try {
        const response = await ApiClient.api.emailTemplateImageControllerUpload(
          formData as unknown as { file: File },
          {
            headers: { "Content-Type": "multipart/form-data" },
            transformRequest: () => formData,
          },
        );
        return response.data.data.url;
      } catch (error) {
        const status = error instanceof AxiosError ? error.response?.status : undefined;
        const message =
          error instanceof AxiosError
            ? (error.response?.data as { message?: string } | undefined)?.message
            : undefined;

        const toastKey = match({ status, message })
          .when(
            ({ status: s }) => s === 413,
            () => "emailTemplates.image.tooLarge" as const,
          )
          .when(
            ({ status: s, message: m }) =>
              s === 400 && typeof m === "string" && m.includes("expected size"),
            () => "emailTemplates.image.tooLarge" as const,
          )
          .when(
            ({ status: s, message: m }) =>
              s === 400 && typeof m === "string" && m.includes("files.toast.invalidFileType"),
            () => "emailTemplates.image.invalidType" as const,
          )
          .otherwise(() => "emailTemplates.image.uploadFailed" as const);

        toast({ description: t(toastKey), variant: "destructive" });
        throw error;
      }
    };

    const getBasePlaceholder = isBase
      ? undefined
      : (uuid: string) => basePlaceholdersRef.current[uuid] ?? null;

    return [
      UuidExtension,
      ButtonFallbackExtension,
      VariableHighlightExtension,
      DisableMailyVariableExtension,
      buildTranslatedPlaceholder(t, getBasePlaceholder),
      ImageUploadExtension.configure({
        allowedMimeTypes: ALLOWED_LESSON_IMAGE_FILE_TYPES,
        onImageUpload: uploadEmailTemplateImage,
      }),
    ];
  }, [t, isBase]);

  const handleUpdate = (editor: Editor) => {
    const doc = editor.getJSON() as EmailTemplateBlocks;
    const packed = packTenantLogoInDoc(doc, logoUrl);
    if (isBase) {
      onBlocksChange(packed);
    } else {
      onStringsChange(extractStringsFromDoc(doc));
      onBlocksChange(applyStructuralChangesToBase(packed, blocks));
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-[600px] rounded-md border border-neutral-200 bg-white px-12 py-4 shadow-sm"
      data-language={language}
    >
      <MailyEditor
        key={language}
        contentJson={initialContent as never}
        onUpdate={handleUpdate}
        extensions={editorExtensions}
        blocks={blockPalette}
        config={{
          hasMenuBar: false,
          bodyClassName: "mly:mt-0 mly:rounded-none mly:border-0 mly:bg-transparent mly:p-0",
        }}
      />
    </div>
  );
};

export default EmailTemplateEditor;
