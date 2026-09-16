import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { EMAIL_TEMPLATE_BLOCK_TYPES } from "../emailTemplates.constants";

import { EmailTemplateImageUpload } from "./EmailTemplateImageUpload";
import { EmailTemplateTextField } from "./EmailTemplateTextField";

import type { EmailTemplateBlock, EmailTemplateVariables } from "../emailTemplates.types";

export type EmailTemplateBlockSettingsProps = {
  block: EmailTemplateBlock;
  variables: EmailTemplateVariables;
  disabled: boolean;
  onChange: (block: EmailTemplateBlock) => void;
  onUpload: (file: File) => Promise<void>;
};

export function EmailTemplateBlockSettings({
  block,
  variables,
  disabled,
  onChange,
  onUpload,
}: EmailTemplateBlockSettingsProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADER && (
        <p className="text-sm text-neutral-600">{t("emailTemplates.ui.brandingHint")}</p>
      )}
      {block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON && (
        <>
          <EmailTemplateTextField
            dense
            stacked
            label={t("emailTemplates.ui.buttonLabel")}
            highlightVariables
            value={block.attrs.label}
            variables={variables}
            disabled={disabled}
            onChange={(label) => onChange({ ...block, attrs: { ...block.attrs, label } })}
          />
          <EmailTemplateTextField
            dense
            stacked
            label={t("emailTemplates.ui.url")}
            highlightVariables
            value={block.attrs.url}
            variables={variables}
            disabled={disabled}
            onChange={(url) => onChange({ ...block, attrs: { ...block.attrs, url } })}
          />
        </>
      )}
      {block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE && (
        <>
          {!block.attrs.src.startsWith("asset:") && (
            <EmailTemplateTextField
              dense
              stacked
              label={t("emailTemplates.ui.imageSource")}
              highlightVariables
              variables={variables}
              value={block.attrs.src}
              disabled={disabled}
              onChange={(src) => onChange({ ...block, attrs: { ...block.attrs, src } })}
            />
          )}
          <EmailTemplateImageUpload
            source={block.attrs.src}
            disabled={disabled}
            onUpload={onUpload}
          />
          <EmailTemplateTextField
            dense
            stacked
            label={t("emailTemplates.ui.altText")}
            highlightVariables
            variables={variables}
            value={block.attrs.alt}
            disabled={disabled}
            onChange={(alt) => onChange({ ...block, attrs: { ...block.attrs, alt } })}
          />
          <Label className="flex flex-col gap-3 text-xs">
            <span>{t("emailTemplates.ui.width")}</span>
            <Input
              className="h-8 py-1"
              type="number"
              min={1}
              max={1200}
              value={block.attrs.width ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...block,
                  attrs: {
                    ...block.attrs,
                    width: event.target.value ? Number(event.target.value) : undefined,
                  },
                })
              }
            />
          </Label>
        </>
      )}
      {(block.type === EMAIL_TEMPLATE_BLOCK_TYPES.SPACER ||
        block.type === EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER) && (
        <Label className="flex flex-col gap-3 text-xs">
          <span>
            {t(
              block.type === EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER
                ? "emailTemplates.ui.dividerHeight"
                : "emailTemplates.ui.height",
            )}
          </span>
          <Input
            className="h-8 py-1"
            type="number"
            min={block.type === EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER ? 1 : 0}
            max={200}
            disabled={disabled}
            value={block.attrs?.height ?? 1}
            onChange={(event) =>
              onChange({
                ...block,
                attrs: {
                  height: Math.min(
                    200,
                    Math.max(
                      block.type === EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER ? 1 : 0,
                      Number(event.target.value),
                    ),
                  ),
                },
              })
            }
          />
        </Label>
      )}
    </div>
  );
}
