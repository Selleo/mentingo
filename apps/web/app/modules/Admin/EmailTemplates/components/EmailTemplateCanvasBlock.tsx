import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Anchor, Arrow } from "@radix-ui/react-popover";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import { EMAIL_TEMPLATE_BLOCK_TYPES, EMAIL_TEMPLATE_DRAG_TYPES } from "../emailTemplates.constants";
import { getEmailTemplateVariableRanges } from "../emailTemplateVariableHighlight.utils";

import { EmailTemplateCanvasImage } from "./EmailTemplateCanvasImage";
import { EmailTemplateRichText } from "./EmailTemplateRichText";

import type {
  EmailTemplateBlockMoveDirection,
  EmailTemplateVariableInserter,
  EmailTemplateBlock,
  EmailTemplateParagraph,
  EmailTemplateVariables,
} from "../emailTemplates.types";

export type EmailTemplateCanvasBlockProps = {
  id: string;
  block: EmailTemplateBlock;
  index: number;
  count: number;
  selected: boolean;
  disabled: boolean;
  variables: EmailTemplateVariables;
  logoUrl?: string | null;
  companyName: string;
  primaryColor?: string | null;
  onSelect: () => void;
  onChange: (block: EmailTemplateBlock) => void;
  onMove: (direction: EmailTemplateBlockMoveDirection) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onRegisterVariableInserter: (insert: EmailTemplateVariableInserter) => void;
  validationError?: string;
};

export type EmailTemplateCanvasParagraphsProps = {
  content: EmailTemplateParagraph[];
  variables: EmailTemplateVariables;
};

function CanvasParagraphs({ content, variables }: EmailTemplateCanvasParagraphsProps) {
  return (
    <div className="flow-root">
      {content.map((paragraph, index) => {
        const variableRanges = getEmailTemplateVariableRanges(
          (paragraph.content ?? []).map((node) => node.text).join(""),
          variables,
        );
        let offset = 0;
        return (
          <p key={index} className="whitespace-pre-wrap">
            {paragraph.content?.map((node, nodeIndex) => {
              const start = offset;
              offset += node.text.length;
              const highlightBoundaries = [
                0,
                ...variableRanges
                  .flatMap((range) => [range.from - start, range.to - start])
                  .filter((position) => position > 0 && position < node.text.length),
                node.text.length,
              ];
              return (
                <span
                  key={nodeIndex}
                  className={cn({
                    "font-bold": node.marks?.some((mark) => mark.type === "bold"),
                    italic: node.marks?.some((mark) => mark.type === "italic"),
                    "underline text-primary-700": node.marks?.some((mark) => mark.type === "link"),
                  })}
                >
                  {highlightBoundaries.slice(0, -1).map((from, partIndex) => (
                    <span
                      key={from}
                      className={cn({
                        "text-primary-700": variableRanges.some(
                          (range) => start + from >= range.from && start + from < range.to,
                        ),
                      })}
                    >
                      {node.text.slice(from, highlightBoundaries[partIndex + 1])}
                    </span>
                  ))}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

export function EmailTemplateCanvasBlock({
  id,
  block,
  index,
  count,
  selected,
  disabled,
  variables,
  logoUrl,
  companyName,
  primaryColor,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onRegisterVariableInserter,
  validationError,
}: EmailTemplateCanvasBlockProps) {
  const { t } = useTranslation();
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
    data: { kind: EMAIL_TEMPLATE_DRAG_TYPES.BLOCK, index },
  });
  const paragraphs = "content" in block ? block.content : undefined;
  let content = <></>;
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADER)
    content = (
      <div className="pb-16 pt-10">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="h-8 max-w-full object-contain" />
        ) : (
          <Icon name="AppLogo" className="h-8 w-40" />
        )}
      </div>
    );
  if (
    block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING ||
    block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT ||
    block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER
  ) {
    const paragraphContent = paragraphs ?? [
      {
        type: "paragraph" as const,
        content: [
          {
            type: "text" as const,
            text: block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER ? block.attrs.text : "",
          },
        ],
      },
    ];
    content = (
      <div
        className={cn("break-words", {
          "min-h-8 [&_.tiptap]:min-h-8":
            !disabled &&
            !paragraphContent.some((paragraph) =>
              paragraph.content?.some((node) => node.text.trim()),
            ),
          "font-gothic text-2xl font-normal leading-[1.6] [&_p]:!mb-8 [&_p]:!mt-0":
            block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING,
          "text-[12.8px] leading-[1.5] [&_p]:!mb-4 [&_p]:!mt-0":
            block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT,
          "py-14 text-center text-xs leading-[24px] text-[#949494] [&_p]:!m-0":
            block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER,
        })}
      >
        {selected && !disabled ? (
          <EmailTemplateRichText
            inline
            content={paragraphContent}
            variables={variables}
            disabled={disabled}
            onRegisterVariableInserter={onRegisterVariableInserter}
            onChange={(content) => onChange({ ...block, content })}
          />
        ) : (
          <CanvasParagraphs content={paragraphContent} variables={variables} />
        )}
      </div>
    );
  }
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON)
    content = (
      <div className="mx-auto max-w-[80%] pb-12 pt-16 text-center">
        <span
          className="font-gothic inline-block max-w-full break-words rounded-full bg-primary-700 px-14 py-3 text-base font-normal tracking-[0.2rem] text-white"
          style={{ backgroundColor: primaryColor || undefined }}
        >
          {block.attrs.label || t("emailTemplates.ui.buttonLabel")}
        </span>
      </div>
    );
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE)
    content = <EmailTemplateCanvasImage block={block} />;
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER)
    content = (
      <hr
        className="my-0 w-full border-[#eaeaea]"
        style={{ borderTopWidth: block.attrs?.height ?? 1 }}
      />
    );
  if (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.SPACER)
    content = <div style={{ height: block.attrs.height }} />;
  return (
    <Popover open={Boolean(validationError)}>
      <Anchor asChild>
        <section
          id={id}
          ref={setNodeRef}
          style={{ transform: CSS.Transform.toString(transform), transition }}
          data-testid={EMAIL_TEMPLATES_HANDLES.BLOCK}
          aria-describedby={validationError ? `${id}-error` : undefined}
          aria-label={`${t(`emailTemplates.ui.blocks.${block.type}`)} ${index + 1}`}
          className={cn(
            "group relative after:pointer-events-none after:absolute after:inset-0 after:border-y after:border-transparent",
            {
              "after:border-primary-400": selected && !disabled,
              "hover:after:border-primary-400 focus-within:after:border-primary-400": !disabled,
              "opacity-30": isDragging,
              "ring-1 ring-inset ring-destructive": Boolean(validationError),
            },
          )}
        >
          {!disabled && (
            <div
              className={cn(
                "absolute top-0 right-1 z-20 flex -translate-y-1/2 rounded-md border bg-white p-0.5 shadow-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 [&>button]:size-7",
                { "opacity-100": selected },
              )}
            >
              <Button
                ref={setActivatorNodeRef}
                type="button"
                variant="ghost"
                size="icon"
                {...attributes}
                {...listeners}
                data-testid={EMAIL_TEMPLATES_HANDLES.DRAG_BLOCK}
                aria-label={t("emailTemplates.ui.dragBlock")}
                className="touch-none cursor-grab"
              >
                <GripVertical className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === 0}
                aria-label={t("emailTemplates.ui.moveUp")}
                onClick={() => onMove(-1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === count - 1}
                aria-label={t("emailTemplates.ui.moveDown")}
                onClick={() => onMove(1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={EMAIL_TEMPLATES_HANDLES.DUPLICATE_BLOCK}
                aria-label={t("emailTemplates.ui.duplicateBlock")}
                onClick={onDuplicate}
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={EMAIL_TEMPLATES_HANDLES.REMOVE_BLOCK}
                aria-label={t("emailTemplates.ui.removeBlock")}
                onClick={onRemove}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
          {selected &&
          !disabled &&
          (block.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING ||
            block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT ||
            block.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER) ? (
            <div className="px-[10%]">{content}</div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              aria-label={`${t("emailTemplates.ui.editBlock")} ${t(`emailTemplates.ui.blocks.${block.type}`)}`}
              data-testid={EMAIL_TEMPLATES_HANDLES.EDIT_BLOCK}
              onClick={onSelect}
              className="block w-full px-[10%] text-left disabled:cursor-default"
            >
              {content}
            </button>
          )}
        </section>
      </Anchor>
      {validationError && (
        <PopoverContent
          side="left"
          sideOffset={12}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="pointer-events-none w-40 border-destructive bg-white px-3 py-2 text-left text-xs font-normal text-destructive shadow-sm"
        >
          <div id={`${id}-error`} role="alert">
            {validationError}
          </div>
          <Arrow className="fill-destructive" />
        </PopoverContent>
      )}
    </Popover>
  );
}
