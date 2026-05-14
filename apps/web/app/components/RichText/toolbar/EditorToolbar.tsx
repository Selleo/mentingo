import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Undo,
  CheckSquare,
  Link2,
  FilePlus,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { ToggleGroup, Toolbar } from "~/components/ui/toolbar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";
import { AssetLibraryDialog, type AssetLibraryConfig } from "../components/AssetLibraryDialog";
import { InsertLinkDialog } from "../components/InsertLinkDialog";

import { FormatType } from "./FormatType";
import { TableMenu } from "./TableMenu";

import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import type React from "react";

type EditorToolbarProps = {
  editor: Editor;
  acceptedFileTypes: readonly string[];
  assetLibrary?: AssetLibraryConfig;
  showTableControls?: boolean;
};

type ToolbarButtonProps = {
  icon: LucideIcon;
  tooltip: string;
  onClick: (event: React.MouseEvent) => void;
  isActive?: boolean;
  disabled?: boolean;
  testId?: string;
};

const ToolbarSection = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-x-1 border-r border-neutral-200 pr-2 last:border-r-0 last:pr-0">
    {children}
  </div>
);

const ToolbarIconButton = ({
  icon: Icon,
  tooltip,
  onClick,
  isActive = false,
  disabled = false,
  testId,
}: ToolbarButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        data-testid={testId}
        type="button"
        size="sm"
        disabled={disabled}
        className={cn("bg-transparent text-black", {
          "bg-primary-100": isActive,
          "hover:bg-primary-100": !isActive && !disabled,
        })}
        onClick={onClick}
      >
        <Icon className="size-4" aria-hidden />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
);

const EditorToolbar = ({
  editor,
  acceptedFileTypes,
  assetLibrary,
  showTableControls = false,
}: EditorToolbarProps) => {
  const { t } = useTranslation();

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);

  const handleToggle = (action: () => void) => (event: React.MouseEvent) => {
    event.preventDefault();
    action();
  };

  const handleLink = handleToggle(() => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      setIsLinkDialogOpen(true);
    }
  });

  const handleAssetLibraryToggle = handleToggle(() => {
    setIsAssetLibraryOpen(true);
  });

  return (
    <Toolbar
      className="m-0 flex items-center justify-between overflow-x-scroll p-2"
      aria-label="Formatting options"
    >
      <TooltipProvider>
        <ToggleGroup className="flex flex-row items-center gap-x-2" type="multiple">
          <ToolbarSection>
            <FormatType editor={editor} />
          </ToolbarSection>

          <ToolbarSection>
            <ToolbarIconButton
              icon={Bold}
              tooltip={t("richTextEditor.toolbar.bold.tooltip")}
              isActive={editor.isActive("bold")}
              onClick={handleToggle(() => editor.chain().focus().toggleBold().run())}
            />
            <ToolbarIconButton
              icon={Italic}
              tooltip={t("richTextEditor.toolbar.italic.tooltip")}
              isActive={editor.isActive("italic")}
              onClick={handleToggle(() => editor.chain().focus().toggleItalic().run())}
            />
            <ToolbarIconButton
              icon={Strikethrough}
              tooltip={t("richTextEditor.toolbar.strikethrough.tooltip")}
              isActive={editor.isActive("strike")}
              onClick={handleToggle(() => editor.chain().focus().toggleStrike().run())}
            />
            <ToolbarIconButton
              icon={Link2}
              tooltip={t("richTextEditor.toolbar.link.tooltip")}
              isActive={editor.isActive("link")}
              onClick={handleLink}
            />
          </ToolbarSection>

          <ToolbarSection>
            <ToolbarIconButton
              icon={List}
              tooltip={t("richTextEditor.toolbar.bulletList.tooltip")}
              isActive={editor.isActive("bulletList")}
              onClick={handleToggle(() => editor.chain().focus().toggleBulletList().run())}
            />
            <ToolbarIconButton
              icon={ListOrdered}
              tooltip={t("richTextEditor.toolbar.orderedList.tooltip")}
              isActive={editor.isActive("orderedList")}
              onClick={handleToggle(() => editor.chain().focus().toggleOrderedList().run())}
            />
            <ToolbarIconButton
              icon={CheckSquare}
              tooltip={t("richTextEditor.toolbar.taskList.tooltip")}
              isActive={editor.isActive("taskList")}
              onClick={handleToggle(() => editor.chain().focus().toggleTaskList().run())}
            />
          </ToolbarSection>

          <ToolbarSection>
            <ToolbarIconButton
              icon={Quote}
              tooltip={t("richTextEditor.toolbar.blockquote.tooltip")}
              isActive={editor.isActive("blockquote")}
              onClick={handleToggle(() => editor.chain().focus().toggleBlockquote().run())}
            />
            <ToolbarIconButton
              icon={Code}
              tooltip={t("richTextEditor.toolbar.codeBlock.tooltip")}
              isActive={editor.isActive("codeBlock")}
              onClick={handleToggle(() => editor.chain().focus().toggleCodeBlock().run())}
            />
            <ToolbarIconButton
              icon={Minus}
              tooltip={t("richTextEditor.toolbar.horizontalRule.tooltip")}
              onClick={handleToggle(() => editor.chain().focus().setHorizontalRule().run())}
            />
          </ToolbarSection>

          {showTableControls && (
            <ToolbarSection>
              <TableMenu editor={editor} />
            </ToolbarSection>
          )}

          {assetLibrary && (
            <ToolbarSection>
              <ToolbarIconButton
                icon={FilePlus}
                tooltip={t("richTextEditor.toolbar.assetLibrary.tooltip")}
                testId={RICH_TEXT_HANDLES.ASSET_LIBRARY_BUTTON}
                onClick={handleAssetLibraryToggle}
              />
            </ToolbarSection>
          )}
        </ToggleGroup>
        <ToggleGroup
          className="invisible flex flex-row items-center gap-x-2 sm:visible"
          type="multiple"
        >
          <ToolbarSection>
            <ToolbarIconButton
              icon={Undo}
              tooltip={t("richTextEditor.toolbar.undo.tooltip")}
              disabled={!editor.can().chain().focus().undo().run()}
              onClick={handleToggle(() => editor.chain().focus().undo().run())}
            />
            <ToolbarIconButton
              icon={Redo}
              tooltip={t("richTextEditor.toolbar.redo.tooltip")}
              disabled={!editor.can().chain().focus().redo().run()}
              onClick={handleToggle(() => editor.chain().focus().redo().run())}
            />
          </ToolbarSection>
        </ToggleGroup>
      </TooltipProvider>
      <InsertLinkDialog
        open={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        editor={editor}
      />
      {assetLibrary && (
        <AssetLibraryDialog
          open={isAssetLibraryOpen}
          onOpenChange={setIsAssetLibraryOpen}
          editor={editor}
          config={assetLibrary}
          acceptedFileTypes={acceptedFileTypes}
        />
      )}
    </Toolbar>
  );
};

export default EditorToolbar;
