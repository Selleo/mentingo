import { AUTOMATION_STATUSES } from "@repo/shared";
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Power,
  PowerOff,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import type { AutomationStatus } from "@repo/shared";

interface BuilderHeaderProps {
  name: string;
  description: string;
  status: AutomationStatus;
  busy: boolean;
  simulating: boolean;
  readonly: boolean;
  hasUnsavedChanges: boolean;
  hasUnappliedChanges: boolean;
  toggleDisabled: boolean;
  archiveDisabled: boolean;
  deleteDisabled: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
  onApply: () => void;
  onSimulate: () => void;
  onToggle: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const menuItemClassName =
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export function BuilderHeader(props: BuilderHeaderProps) {
  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [saveMenuWidth, setSaveMenuWidth] = useState<number>();
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const applyControlsRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const isActive = props.status === AUTOMATION_STATUSES.ENABLED;
  const canSaveDraft = !props.busy && !props.readonly && props.hasUnsavedChanges;
  const canApply =
    !props.busy && !props.readonly && (props.hasUnsavedChanges || props.hasUnappliedChanges);

  useEffect(() => {
    if (isEditingName) nameRef.current?.focus();
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingDescription) descriptionRef.current?.focus();
  }, [isEditingDescription]);

  return (
    <header className="shrink-0 border-b bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={props.onBack}
            aria-label={t("automationBuilder.header.back")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          {isEditingName ? (
            <>
              <Label className="sr-only" htmlFor="automation-name">
                {t("automations.name")}
              </Label>
              <Input
                id="automation-name"
                ref={nameRef}
                className="h-8 min-w-0 w-full max-w-full px-2 py-0 text-base font-semibold sm:w-[33vw]"
                value={props.name}
                disabled={props.readonly}
                placeholder={t("automations.name")}
                onChange={(event) => props.onNameChange(event.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </>
          ) : (
            <button
              type="button"
              disabled={props.readonly}
              onClick={() => setIsEditingName(true)}
              aria-label={t("automations.name")}
              className="group flex h-8 min-w-0 w-full max-w-full items-center gap-2 rounded border border-transparent px-2 sm:w-[33vw] text-left text-base font-semibold hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
            >
              <span className="truncate">{props.name || t("automations.name")}</span>
              {!props.readonly && (
                <Pencil
                  className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              )}
            </button>
          )}
        </div>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-3">
          {(props.hasUnsavedChanges || props.hasUnappliedChanges) && (
            <span
              className="inline-flex h-10 items-center text-xs leading-none text-neutral-500"
              role="status"
            >
              {t(
                props.hasUnsavedChanges
                  ? "automationBuilder.header.unsavedChanges"
                  : "automations.unapplied",
              )}
            </span>
          )}
          <Button
            variant="outline"
            className="gap-2"
            disabled={props.busy || props.readonly || props.simulating}
            onClick={props.onSimulate}
          >
            {props.simulating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {t("automations.simulate")}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={props.toggleDisabled}
            onClick={props.onToggle}
          >
            {isActive ? (
              <PowerOff className="size-4" aria-hidden="true" />
            ) : (
              <Power className="size-4" aria-hidden="true" />
            )}
            {t(isActive ? "automations.disable" : "automations.enable")}
          </Button>
          <div
            ref={applyControlsRef}
            className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center"
          >
            <span
              aria-hidden="true"
              className="invisible pointer-events-none col-span-2 col-start-1 row-start-1 flex h-0 items-center justify-center gap-2 whitespace-nowrap px-3 text-sm font-medium"
            >
              <Save className="size-4 shrink-0" />
              {t("automations.save")}
            </span>
            <Button
              variant="primary"
              className={cn("col-start-1 row-start-1 whitespace-nowrap rounded-r-none", {
                "rounded-bl-none": isSaveMenuOpen,
              })}
              disabled={!canApply}
              onClick={props.onApply}
            >
              {t("automations.apply")}
            </Button>
            <DropdownMenu
              open={isSaveMenuOpen}
              onOpenChange={(isOpen) => {
                setIsSaveMenuOpen(isOpen);
                if (isOpen) {
                  setSaveMenuWidth(applyControlsRef.current?.getBoundingClientRect().width);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="primary"
                  className={cn(
                    "col-start-2 row-start-1 rounded-l-none border-l border-white/25 px-2",
                    { "rounded-br-none": isSaveMenuOpen },
                  )}
                  disabled={!canSaveDraft}
                  aria-label={t("automationBuilder.header.saveOptions")}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={0}
                avoidCollisions={false}
                style={{ width: saveMenuWidth }}
                className="min-w-0 rounded-t-none rounded-b-lg border-0 bg-transparent p-0 shadow-none"
              >
                <DropdownMenuItem
                  className="flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-t-none rounded-b-lg border border-input bg-background px-3 text-sm font-medium text-primary-800 outline-none transition-colors hover:border-primary-500 focus:border-primary-500 focus:bg-primary-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  disabled={!canSaveDraft}
                  onSelect={props.onSave}
                >
                  <Save className="size-4 shrink-0" />
                  {t("automations.save")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t("automationView.table.manage")}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 space-y-1 p-2">
              <DropdownMenuItem
                className={cn(
                  menuItemClassName,
                  "text-error-700 focus:bg-error-50 focus:text-error-700",
                )}
                disabled={props.archiveDisabled}
                onSelect={props.onArchive}
              >
                <Archive className="size-4" />
                {t("automations.archive")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  menuItemClassName,
                  "text-error-700 focus:bg-error-50 focus:text-error-700",
                )}
                disabled={props.deleteDisabled}
                onSelect={props.onDelete}
              >
                <Trash2 className="size-4" />
                {t("automationView.deleteDialog.confirm")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="ml-10 w-[calc(100%-2.5rem)] sm:w-[33vw]">
        {isEditingDescription ? (
          <>
            <Label className="sr-only" htmlFor="automation-description">
              {t("automations.descriptionLabel")}
            </Label>
            <Input
              id="automation-description"
              ref={descriptionRef}
              value={props.description}
              disabled={props.readonly}
              placeholder={t("automations.descriptionLabel")}
              className="h-5 min-h-0 w-full px-2 py-0 text-xs leading-none text-neutral-500"
              onChange={(event) => props.onDescriptionChange(event.target.value)}
              onBlur={() => setIsEditingDescription(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "Escape") {
                  event.currentTarget.blur();
                }
              }}
            />
          </>
        ) : (
          <button
            type="button"
            disabled={props.readonly}
            onClick={() => setIsEditingDescription(true)}
            aria-label={t("automations.descriptionLabel")}
            className="group flex h-5 w-full items-center gap-2 rounded border border-transparent px-2 text-left text-xs leading-none text-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          >
            <span className="truncate">
              {props.description || t("automations.descriptionLabel")}
            </span>
            {!props.readonly && (
              <Pencil
                className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
