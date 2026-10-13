import { useNavigate } from "@remix-run/react";
import { Info } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateEmailTemplate } from "~/api/mutations/emailTemplates/useCreateEmailTemplate";
import { useEmailTemplateEvents } from "~/api/queries/useEmailTemplateEvents";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AutomationSearchSelect } from "../../Automations/Builder/components/AutomationSearchSelect";
import { EMAIL_TEMPLATE_LIST_PATH } from "../emailTemplates.constants";
import { createEmptyEmailTemplateDocument } from "../emailTemplates.utils";

const NO_EVENT_SELECTED = "none";

export function CreateEmailTemplateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const populateTagsId = useId();
  const language = useLanguageStore((state) => state.language);
  const [name, setName] = useState("");
  const [eventKind, setEventKind] = useState(NO_EVENT_SELECTED);
  const [populateEventTags, setPopulateEventTags] = useState(true);
  const { data: events, isPending: isLoadingEvents, isError, refetch } = useEmailTemplateEvents();
  const { mutateAsync: createTemplate, isPending: isCreating } = useCreateEmailTemplate();
  const selectedEvent = events?.find((event) => event.kind === eventKind);

  function handleCreate() {
    if (!name.trim() || isCreating) return;

    void createTemplate({
      name: { [language]: name.trim() },
      subject: { [language]: "" },
      content: { [language]: createEmptyEmailTemplateDocument() },
      baseLanguage: language,
      placeholders: [],
      triggerEventKind: selectedEvent?.kind,
      populateEventTags: Boolean(selectedEvent) && populateEventTags,
    })
      .then((created) => {
        onClose();
        navigate(`${EMAIL_TEMPLATE_LIST_PATH}/${created.id}`);
      })
      .catch(() => undefined);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isCreating) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("emailTemplates.ui.creationTitle")}</DialogTitle>
          <DialogDescription>{t("emailTemplates.ui.creationDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <label className="flex flex-col gap-2 text-sm font-medium">
            {t("emailTemplates.ui.name")}
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={200}
              disabled={isCreating}
            />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("emailTemplates.ui.intendedEvent")}</p>
            <AutomationSearchSelect
              value={eventKind}
              label={t("emailTemplates.ui.intendedEvent")}
              placeholder={t("emailTemplates.ui.chooseEventLater")}
              disabled={isCreating || isLoadingEvents || isError}
              groups={[
                {
                  options: [
                    { value: NO_EVENT_SELECTED, label: t("emailTemplates.ui.chooseEventLater") },
                  ],
                },
                {
                  options: (events ?? []).map((event) => ({
                    value: event.kind,
                    label: t(`emailTemplates.events.${event.kind}`, { defaultValue: event.label }),
                  })),
                },
              ]}
              onValueChange={setEventKind}
            />
            {isError && (
              <p role="alert" className="text-sm text-destructive">
                {t("emailTemplates.ui.requestFailed")}{" "}
                <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                  {t("emailTemplates.ui.retry")}
                </Button>
              </p>
            )}
          </div>
          {selectedEvent && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={populateTagsId}
                checked={populateEventTags}
                disabled={isCreating}
                onCheckedChange={(checked) => setPopulateEventTags(checked === true)}
              />
              <label htmlFor={populateTagsId} className="cursor-pointer text-sm text-neutral-700">
                {t("emailTemplates.ui.populateEventTags")}
              </label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("emailTemplates.ui.populateEventTagsHint")}
                      className="flex size-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-relaxed">
                    {t("emailTemplates.ui.populateEventTagsHint")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isCreating} onClick={onClose}>
              {t("common.button.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={isCreating || !name.trim()}>
              {t("emailTemplates.ui.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
