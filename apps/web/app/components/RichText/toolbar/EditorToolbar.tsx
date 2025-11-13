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
  UploadCloudIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLessonFileUpload } from "~/api/mutations/admin/useLessonFileUpload";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ToggleGroup, Toolbar } from "~/components/ui/toolbar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { InsertLinkDialog } from "../components/InsertLinkDialog";

import { FormatType } from "./FormatType";

import type { Editor } from "@tiptap/react";
import type React from "react";

type EditorToolbarProps = {
  editor: Editor;
  allowFiles?: boolean;
  lessonId?: string;
};

const EditorToolbar = ({ editor, lessonId, allowFiles = false }: EditorToolbarProps) => {
  const { t } = useTranslation();
  const { mutateAsync: uploadImage } = useLessonFileUpload();

  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);

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

  const handleUploadToggle = handleToggle(() => {
    fileUploadRef.current?.click();
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !lessonId) {
      return;
    }

    const uploaded = await uploadImage({ file, lessonId });

    const url = `${import.meta.env.VITE_APP_URL}/api/lesson/lesson-image/${uploaded}`;

    editor.chain().insertContent(`<a href="${url}">${url}</a>`).run();

    if (fileUploadRef.current) {
      fileUploadRef.current.value = "";
    }
  };

  return (
    <Toolbar
      className="m-0 flex items-center justify-between overflow-x-scroll p-2"
      aria-label="Formatting options"
    >
      <TooltipProvider>
        <ToggleGroup className="flex flex-row items-center gap-x-1" type="multiple">
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={cn("bg-transparent text-black", {
                  "bg-primary-100": editor.isActive("link"),
                  "hover:bg-primary-100": !editor.isActive("link"),
                })}
                onClick={handleLink}
              >
                <Link2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("richTextEditor.toolbar.link.tooltip")}</TooltipContent>
          </Tooltip>
          {allowFiles && (
            <Tooltip>
              <TooltipTrigger>
                <Input
                  type="file"
                  className="hidden"
                  ref={fileUploadRef}
                  onChange={handleUpload}
                  accept="image/*"
                />
                <Button
                  size="sm"
                  className={cn("bg-transparent text-black", {
                    "bg-primary-100": editor.isActive("upload"),
                    "hover:bg-primary-100": !editor.isActive("upload"),
                  })}
                  onClick={handleUploadToggle}
                >
                  <UploadCloudIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload: Allows you to upload an image</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={`bg-transparent text-black ${editor.isActive("bold") ? "bg-primary-100" : "hover:bg-primary-100"}`}
                onClick={handleToggle(() => editor.chain().focus().toggleBold().run())}
              >
                <Bold className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold: Makes selected text bold</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={`bg-transparent text-black ${editor.isActive("italic") ? "bg-primary-100" : "hover:bg-primary-100"}`}
                onClick={handleToggle(() => editor.chain().focus().toggleItalic().run())}
              >
                <Italic className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic: Italicizes the selected text</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={`bg-transparent text-black ${editor.isActive("strike") ? "bg-primary-100" : "hover:bg-primary-100"}`}
                onClick={handleToggle(() => editor.chain().focus().toggleStrike().run())}
              >
                <Strikethrough className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Strikethrough: Adds a line through the text</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={`bg-transparent text-black ${editor.isActive("bulletList") ? "bg-primary-100" : "hover:bg-primary-100"}`}
                onClick={handleToggle(() => editor.chain().focus().toggleBulletList().run())}
              >
                <List className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List: Starts a bulleted list</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={`bg-transparent text-black ${editor.isActive("orderedList") ? "bg-primary-100" : "hover:bg-primary-100"}`}
                onClick={handleToggle(() => editor.chain().focus().toggleOrderedList().run())}
              >
                <ListOrdered className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ordered List: Starts a numbered list</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={`bg-transparent text-black ${editor.isActive("codeBlock") ? "bg-primary-100" : "hover:bg-primary-100"}`}
                onClick={handleToggle(() => editor.chain().focus().toggleCodeBlock().run())}
              >
                <Code className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Code Block: Formats text as code</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={`bg-transparent text-black ${editor.isActive("blockquote") ? "bg-primary-100" : "hover:bg-primary-100"}`}
                onClick={handleToggle(() => editor.chain().focus().toggleBlockquote().run())}
              >
                <Quote className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quote: Formats text as a blockquote</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                onClick={handleToggle(() => editor.chain().focus().setHorizontalRule().run())}
                className={`bg-transparent text-black hover:bg-primary-100`}
              >
                <Minus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Horizontal Rule: Inserts a horizontal line</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                className={cn("bg-transparent text-black", {
                  "bg-primary-100": editor.isActive("taskList"),
                  "hover:bg-primary-100": !editor.isActive("taskList"),
                })}
                onClick={handleToggle(() => editor.chain().focus().toggleTaskList().run())}
              >
                <CheckSquare className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Checkbox: Adds a checklist</TooltipContent>
          </Tooltip>

          <FormatType editor={editor} />
        </ToggleGroup>
        <ToggleGroup
          className="invisible flex flex-row items-center gap-x-1 sm:visible"
          type="multiple"
        >
          <Button
            size="sm"
            onClick={handleToggle(() => editor.chain().focus().undo().run())}
            className={`bg-transparent text-black ${editor.can().chain().focus().undo().run() ? "hover:bg-primary-100" : ""}`}
          >
            <Undo className="size-4" />
          </Button>

          <Button
            size="sm"
            onClick={handleToggle(() => editor.chain().focus().redo().run())}
            className={`bg-transparent text-black ${editor.can().chain().focus().redo().run() ? "hover:bg-primary-100" : ""}`}
          >
            <Redo className="size-4" />
          </Button>
        </ToggleGroup>
      </TooltipProvider>
      <InsertLinkDialog
        open={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        editor={editor}
      />
    </Toolbar>
  );
};

export default EditorToolbar;
