import {
  Columns2,
  Combine,
  Grid2x2Plus,
  Hammer,
  PanelLeft,
  PanelLeftClose,
  PanelTop,
  PanelTopClose,
  Rows2,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  TableColumnsSplit,
  TableProperties,
  TableRowsSplit,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { RICH_TEXT_HANDLES } from "../../../../e2e/data/common/handles";

import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";

type TableMenuProps = {
  editor: Editor;
};

type TableAction = {
  labelKey: string;
  icon: LucideIcon;
  action: () => void;
  disabled?: boolean;
  testId?: string;
};

const TableMenuItem = ({ labelKey, icon: Icon, action, disabled, testId }: TableAction) => {
  const { t } = useTranslation();

  return (
    <DropdownMenuItem
      data-testid={testId}
      disabled={disabled}
      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      onSelect={(event) => {
        event.preventDefault();
        action();
      }}
    >
      <Icon className="size-4" aria-hidden />
      {t(labelKey)}
    </DropdownMenuItem>
  );
};

export const TableMenu = ({ editor }: TableMenuProps) => {
  const { t } = useTranslation();
  const isTableActive = editor.isActive("table");

  const insertActions: TableAction[] = [
    {
      labelKey: "richTextEditor.toolbar.table.actions.insert",
      icon: Grid2x2Plus,
      testId: RICH_TEXT_HANDLES.TABLE_INSERT_BUTTON,
      action: () =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
  ];

  const columnActions: TableAction[] = [
    {
      labelKey: "richTextEditor.toolbar.table.actions.addColumnBefore",
      icon: PanelLeft,
      action: () => editor.chain().focus().addColumnBefore().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.addColumnAfter",
      icon: TableColumnsSplit,
      action: () => editor.chain().focus().addColumnAfter().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.deleteColumn",
      icon: PanelLeftClose,
      action: () => editor.chain().focus().deleteColumn().run(),
      disabled: !isTableActive,
    },
  ];

  const rowActions: TableAction[] = [
    {
      labelKey: "richTextEditor.toolbar.table.actions.addRowBefore",
      icon: PanelTop,
      action: () => editor.chain().focus().addRowBefore().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.addRowAfter",
      icon: TableRowsSplit,
      action: () => editor.chain().focus().addRowAfter().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.deleteRow",
      icon: PanelTopClose,
      action: () => editor.chain().focus().deleteRow().run(),
      disabled: !isTableActive,
    },
  ];

  const cellActions: TableAction[] = [
    {
      labelKey: "richTextEditor.toolbar.table.actions.mergeCells",
      icon: TableCellsMerge,
      action: () => editor.chain().focus().mergeCells().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.splitCell",
      icon: TableCellsSplit,
      action: () => editor.chain().focus().splitCell().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.mergeOrSplit",
      icon: Combine,
      action: () => editor.chain().focus().mergeOrSplit().run(),
      disabled: !isTableActive,
    },
  ];

  const headerActions: TableAction[] = [
    {
      labelKey: "richTextEditor.toolbar.table.actions.toggleHeaderRow",
      icon: Rows2,
      action: () => editor.chain().focus().toggleHeaderRow().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.toggleHeaderColumn",
      icon: Columns2,
      action: () => editor.chain().focus().toggleHeaderColumn().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.toggleHeaderCell",
      icon: TableProperties,
      action: () => editor.chain().focus().toggleHeaderCell().run(),
      disabled: !isTableActive,
    },
  ];

  const tableActions: TableAction[] = [
    {
      labelKey: "richTextEditor.toolbar.table.actions.fixTables",
      icon: Hammer,
      action: () => editor.chain().focus().fixTables().run(),
      disabled: !isTableActive,
    },
    {
      labelKey: "richTextEditor.toolbar.table.actions.deleteTable",
      icon: Trash2,
      action: () => editor.chain().focus().deleteTable().run(),
      disabled: !isTableActive,
    },
  ];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid={RICH_TEXT_HANDLES.TABLE_MENU_BUTTON}
              type="button"
              size="sm"
              className={cn("bg-transparent text-black", {
                "bg-primary-100": isTableActive,
                "hover:bg-primary-100": !isTableActive,
              })}
            >
              <Table2 className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("richTextEditor.toolbar.table.tooltip")}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          {insertActions.map((action) => (
            <TableMenuItem key={action.labelKey} {...action} />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("richTextEditor.toolbar.table.groups.columns")}</DropdownMenuLabel>

        <DropdownMenuGroup>
          {columnActions.map((action) => (
            <TableMenuItem key={action.labelKey} {...action} />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("richTextEditor.toolbar.table.groups.rows")}</DropdownMenuLabel>

        <DropdownMenuGroup>
          {rowActions.map((action) => (
            <TableMenuItem key={action.labelKey} {...action} />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("richTextEditor.toolbar.table.groups.cells")}</DropdownMenuLabel>

        <DropdownMenuGroup>
          {cellActions.map((action) => (
            <TableMenuItem key={action.labelKey} {...action} />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("richTextEditor.toolbar.table.groups.headers")}</DropdownMenuLabel>

        <DropdownMenuGroup>
          {headerActions.map((action) => (
            <TableMenuItem key={action.labelKey} {...action} />
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {tableActions.map((action) => (
            <TableMenuItem key={action.labelKey} {...action} />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
