import { DragOverlay } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";

import { EmailTemplateCanvasBlock } from "./EmailTemplateCanvasBlock";

import type { EmailTemplateBlock, EmailTemplateVariables } from "../emailTemplates.types";

type EmailTemplateDragPreviewProps = {
  draggedBlock?: EmailTemplateBlock;
  draggedBlockId: string | null;
  draggedBlockType: EmailTemplateBlock["type"] | null;
  variables: EmailTemplateVariables;
  logoUrl?: string | null;
  companyName: string;
  primaryColor: string;
};

export function EmailTemplateDragPreview({
  draggedBlock,
  draggedBlockId,
  draggedBlockType,
  variables,
  logoUrl,
  companyName,
  primaryColor,
}: EmailTemplateDragPreviewProps) {
  const { t } = useTranslation();
  return (
    <DragOverlay>
      {draggedBlock && (
        <div
          className="pointer-events-none bg-white text-[#222222] shadow-lg"
          style={{ fontFamily: '"Open Sans", Arial, sans-serif' }}
        >
          <EmailTemplateCanvasBlock
            id={`preview-${draggedBlockId}`}
            block={draggedBlock}
            index={0}
            count={1}
            selected={false}
            disabled
            variables={variables}
            logoUrl={logoUrl}
            companyName={companyName}
            primaryColor={primaryColor}
            onSelect={() => {}}
            onChange={() => {}}
            onMove={() => {}}
            onDuplicate={() => {}}
            onRemove={() => {}}
            onRegisterVariableInserter={() => {}}
          />
        </div>
      )}
      {!draggedBlock && draggedBlockType && (
        <div className="rounded-lg border bg-white px-4 py-2 text-sm shadow-lg">
          {t(`emailTemplates.ui.blocks.${draggedBlockType}`)}
        </div>
      )}
    </DragOverlay>
  );
}
