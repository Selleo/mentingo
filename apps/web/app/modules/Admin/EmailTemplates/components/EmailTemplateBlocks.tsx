import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import EmailBorderCircle from "~/assets/svgs/app-email-border-circle.svg?react";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_BLOCK_OPTIONS,
  EMAIL_TEMPLATE_DRAG_TYPES,
} from "../emailTemplates.constants";
import {
  createEmailTemplateBlock,
  getEmailTemplateBlockValidationError,
  moveEmailTemplateBlock,
  moveEmailTemplateBlockToInsertion,
} from "../emailTemplates.utils";
import { useEmailTemplateBlockIds } from "../useEmailTemplateBlockIds";

import { EmailTemplateBlockSidebar } from "./EmailTemplateBlockSidebar";
import { EmailTemplateCanvasBlock } from "./EmailTemplateCanvasBlock";
import { EmailTemplateCanvasLayout } from "./EmailTemplateCanvasLayout";
import { EmailTemplateCanvasToolbar } from "./EmailTemplateCanvasToolbar";
import { EmailTemplateDragPreview } from "./EmailTemplateDragPreview";
import { EmailTemplateInsertionPoint } from "./EmailTemplateInsertionPoint";
import { EmailTemplateSettingsSidebar } from "./EmailTemplateSettingsSidebar";

import type {
  EmailTemplateVariableInserter,
  EmailTemplateBlock,
  EmailTemplateVariables,
} from "../emailTemplates.types";
import type { DragEndEvent } from "@dnd-kit/core";

export type EmailTemplateBlocksProps = {
  blocks: EmailTemplateBlock[];
  variables: EmailTemplateVariables;
  onChange: (blocks: EmailTemplateBlock[]) => void;
  onUpload: (file: File) => Promise<string | undefined>;
  disabled: boolean;
  logoUrl?: string | null;
  companyName?: string;
  primaryColor?: string | null;
  showValidationErrors?: boolean;
};

export function EmailTemplateBlocks({
  blocks,
  variables,
  onChange,
  onUpload,
  disabled,
  logoUrl,
  companyName = "",
  primaryColor,
  showValidationErrors = false,
}: EmailTemplateBlocksProps) {
  const { t } = useTranslation();

  const { getBlockId, preserveBlockId } = useEmailTemplateBlockIds();

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedBlockType, setDraggedBlockType] = useState<EmailTemplateBlock["type"] | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const draggedBlock = blocks.find((block) => getBlockId(block) === draggedBlockId);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const isEditingDisabled = disabled || isPreviewMode;
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);
  const emailPrimaryColor = primaryColor || "#4796FD";

  let footerStartIndex = blocks.length;

  while (
    footerStartIndex > 0 &&
    blocks[footerStartIndex - 1].type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER
  )
    footerStartIndex -= 1;
  const variableInserterRef = useRef<EmailTemplateVariableInserter>(null);
  const handleRegisterVariableInserter = useCallback((insert: EmailTemplateVariableInserter) => {
    variableInserterRef.current = insert;
  }, []);
  const selectedBlockIndex = blocks.findIndex((block) => getBlockId(block) === selectedBlockId);
  const selectedBlock = blocks[selectedBlockIndex];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleInsertBlock = (type: EmailTemplateBlock["type"], index: number, token?: string) => {
    if (isEditingDisabled) return;
    const block = createEmailTemplateBlock(type);
    if (token && block.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT)
      block.content = [{ type: "paragraph", content: [{ type: "text", text: token }] }];
    const updatedBlocks = [...blocks];
    updatedBlocks.splice(index, 0, block);
    onChange(updatedBlocks);
    setSelectedBlockId(getBlockId(block));
  };

  const handleUpdateBlock = (index: number, block: EmailTemplateBlock) => {
    if (isEditingDisabled) return;
    preserveBlockId(blocks[index], block);
    onChange(blocks.map((existing, position) => (position === index ? block : existing)));
  };

  const handleRemoveBlock = (index: number) => {
    if (isEditingDisabled) return;
    onChange(blocks.filter((_, position) => position !== index));
    if (index === selectedBlockIndex) setSelectedBlockId(null);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggedBlockType(null);
    setDraggedBlockId(null);
    if (isEditingDisabled || !over) return;
    const target = over.data.current;
    if (!target || !Number.isInteger(target.index)) return;
    if (active.data.current?.kind === EMAIL_TEMPLATE_DRAG_TYPES.PALETTE) {
      const type = active.data.current.blockType;
      if (EMAIL_TEMPLATE_BLOCK_OPTIONS.includes(type)) handleInsertBlock(type, target.index);
      return;
    }
    const sourceBlockIndex = blocks.findIndex((block) => getBlockId(block) === active.id);
    let targetInsertionIndex = target.index;
    if (target.kind === EMAIL_TEMPLATE_DRAG_TYPES.BLOCK && targetInsertionIndex > sourceBlockIndex)
      targetInsertionIndex += 1;
    onChange(moveEmailTemplateBlockToInsertion(blocks, sourceBlockIndex, targetInsertionIndex));
    setSelectedBlockId(String(active.id));
  };

  const insertionIndex = selectedBlockIndex < 0 ? blocks.length : selectedBlockIndex + 1;
  const handleInsertVariable = (token: string) => {
    if (isEditingDisabled) return;

    if (
      selectedBlock &&
      (selectedBlock.type === EMAIL_TEMPLATE_BLOCK_TYPES.TEXT ||
        selectedBlock.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING ||
        selectedBlock.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER) &&
      variableInserterRef.current
    ) {
      variableInserterRef.current(token);
      return;
    }

    handleInsertBlock(EMAIL_TEMPLATE_BLOCK_TYPES.TEXT, insertionIndex, token);
  };

  const renderedBlocks = blocks.map((block, index) => (
    <div
      key={getBlockId(block)}
      style={{
        backgroundColor: index === 0 && index < footerStartIndex ? emailPrimaryColor : undefined,
      }}
    >
      <div
        className={cn("relative mx-auto w-full max-w-[500px]", {
          "bg-white": index < footerStartIndex,
          "rounded-t-3xl pt-8": index === 0 && index < footerStartIndex,
          "rounded-b-3xl pb-[50px]": index === footerStartIndex - 1,
        })}
        onMouseEnter={() => setHoveredBlockIndex(index)}
      >
        <EmailTemplateCanvasBlock
          id={getBlockId(block)}
          block={block}
          validationError={
            showValidationErrors && getEmailTemplateBlockValidationError(block)
              ? t(getEmailTemplateBlockValidationError(block)!)
              : undefined
          }
          index={index}
          count={blocks.length}
          variables={variables}
          disabled={isEditingDisabled}
          selected={selectedBlockId === getBlockId(block)}
          logoUrl={logoUrl}
          companyName={companyName}
          primaryColor={emailPrimaryColor}
          onSelect={() => setSelectedBlockId(getBlockId(block))}
          onChange={(updatedBlocks) => handleUpdateBlock(index, updatedBlocks)}
          onMove={(direction) => {
            onChange(moveEmailTemplateBlock(blocks, index, direction));
            setSelectedBlockId(getBlockId(block));
          }}
          onDuplicate={() => {
            const duplicatedBlock = structuredClone(block);
            const updatedBlocks = [...blocks];
            updatedBlocks.splice(index + 1, 0, duplicatedBlock);
            onChange(updatedBlocks);
            setSelectedBlockId(getBlockId(duplicatedBlock));
          }}
          onRemove={() => handleRemoveBlock(index)}
          onRegisterVariableInserter={handleRegisterVariableInserter}
        />
        {index === footerStartIndex - 1 && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 overflow-hidden rounded-bl-3xl"
            aria-hidden="true"
          >
            <EmailBorderCircle className="h-[50px] w-auto" style={{ color: emailPrimaryColor }} />
          </div>
        )}
        <div className="relative">
          <EmailTemplateInsertionPoint
            index={index + 1}
            disabled={isEditingDisabled}
            visible={
              hoveredBlockIndex === index || hoveredBlockIndex === index + 1 || !!draggedBlockType
            }
            onInsert={(type) => handleInsertBlock(type, index + 1)}
          />
        </div>
      </div>
    </div>
  ));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => {
        setDraggedBlockId(
          active.data.current?.kind === EMAIL_TEMPLATE_DRAG_TYPES.BLOCK ? String(active.id) : null,
        );
        const type =
          active.data.current?.blockType ??
          blocks.find((block) => getBlockId(block) === active.id)?.type;
        setDraggedBlockType(type ?? null);
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggedBlockType(null);
        setDraggedBlockId(null);
      }}
    >
      <div
        className={cn("grid overflow-hidden rounded-lg border bg-white", {
          "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]":
            !isPreviewMode,
        })}
      >
        <EmailTemplateBlockSidebar
          variables={variables}
          disabled={isEditingDisabled}
          hidden={isPreviewMode}
          onInsertBlock={(type) => handleInsertBlock(type, insertionIndex)}
          onInsertVariable={handleInsertVariable}
        />
        <div className="min-w-0 bg-neutral-100">
          <EmailTemplateCanvasToolbar
            isMobilePreview={isMobilePreview}
            isPreviewMode={isPreviewMode}
            onMobileChange={setIsMobilePreview}
            onTogglePreview={() => setIsPreviewMode((current) => !current)}
          />
          <div className="overflow-x-auto">
            <div
              data-testid={EMAIL_TEMPLATES_HANDLES.CANVAS}
              className={cn("mx-auto w-full bg-[#fafafa] text-[#222222]", {
                "max-w-[375px]": isMobilePreview,
              })}
              style={{ fontFamily: '"Open Sans", Arial, sans-serif' }}
            >
              <div className="h-[50px]" style={{ backgroundColor: emailPrimaryColor }} />
              <div onMouseLeave={() => setHoveredBlockIndex(null)}>
                <SortableContext
                  items={blocks.map(getBlockId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="relative mx-auto w-[90%] max-w-[500px]">
                    <EmailTemplateInsertionPoint
                      index={0}
                      disabled={isEditingDisabled}
                      visible={!blocks.length || hoveredBlockIndex === 0 || !!draggedBlockType}
                      onInsert={(type) => handleInsertBlock(type, 0)}
                    />
                  </div>
                  {!blocks.length && (
                    <p className="p-8 text-center text-sm text-neutral-500">
                      {t("emailTemplates.ui.emptyContent")}
                    </p>
                  )}
                  <EmailTemplateCanvasLayout primaryColor={emailPrimaryColor}>
                    {renderedBlocks.slice(0, footerStartIndex)}
                  </EmailTemplateCanvasLayout>
                  <div className="mx-auto w-[90%] max-w-[500px]">
                    {renderedBlocks.slice(footerStartIndex)}
                  </div>
                </SortableContext>
              </div>
            </div>
          </div>
        </div>
        <EmailTemplateSettingsSidebar
          onRemoveBlock={handleRemoveBlock}
          blocks={blocks}
          selectedBlockIndex={selectedBlockIndex}
          onSelectBlock={(index) => {
            const blockId = getBlockId(blocks[index]);
            setSelectedBlockId(blockId);
            document.getElementById(blockId)?.scrollIntoView({ block: "nearest" });
          }}
          block={selectedBlock}
          variables={variables}
          disabled={isEditingDisabled}
          hidden={isPreviewMode}
          onChange={(block) => handleUpdateBlock(selectedBlockIndex, block)}
          onUpload={async (file) => {
            const source = await onUpload(file);
            if (source && selectedBlock?.type === EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE)
              handleUpdateBlock(selectedBlockIndex, {
                ...selectedBlock,
                attrs: { ...selectedBlock.attrs, src: source },
              });
          }}
        />
      </div>
      <EmailTemplateDragPreview
        draggedBlock={draggedBlock}
        draggedBlockId={draggedBlockId}
        draggedBlockType={draggedBlockType}
        variables={variables}
        logoUrl={logoUrl}
        companyName={companyName}
        primaryColor={emailPrimaryColor}
      />
    </DndContext>
  );
}
