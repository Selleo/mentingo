import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import { useCompetenciesProfileEditor } from "../hooks/useCompetenciesProfileEditor";

import { CompetenciesCompetencyPicker } from "./CompetenciesCompetencyPicker";
import { CompetenciesProfileRequirementList } from "./CompetenciesProfileRequirementList";

import type { CompetenciesProfileEditorOptions } from "../hooks/competencies-hooks.types";

export type CompetenciesProfileEditorProps = CompetenciesProfileEditorOptions;

export function CompetenciesProfileEditor({ profile, close }: CompetenciesProfileEditorProps) {
  const {
    addRequirement,
    removeRequirement,
    updateRequirementLevel,
    saveProfileDraft,
    t,
    execute,
    isPending,
    confirmDelete,
    setConfirmDelete,
    assigned,
    catalog,
    value,
    setValue,
    isAvailableCompetency,
    isResolvingRequirements,
  } = useCompetenciesProfileEditor({ profile, close });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) close();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 py-5">
          <DialogTitle>
            {t(profile ? "competencies.editProfile" : "competencies.newProfile")}
          </DialogTitle>
        </DialogHeader>
        <form className="flex min-h-0 flex-col" onSubmit={saveProfileDraft}>
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <fieldset disabled={isPending} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">{t("competencies.name")}</Label>
                <Input
                  id="profile-name"
                  required
                  value={value.name}
                  onChange={(event) => setValue({ ...value, name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-description">{t("competencies.description")}</Label>
                <Textarea
                  id="profile-description"
                  value={value.description}
                  onChange={(event) => setValue({ ...value, description: event.target.value })}
                />
              </div>
              <div className="flex min-h-0 flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label id="profile-requirements-label">
                      {t("competencies.requiredCompetencies")}
                    </Label>
                    <p className="details text-neutral-700">
                      {t("competencies.profileEditor.requirementsHelp")}
                    </p>
                  </div>
                  <CompetenciesCompetencyPicker
                    label={t("competencies.profileEditor.addCompetency")}
                    hideLabel
                    className="w-full sm:w-72"
                    value=""
                    placeholder={t("competencies.profileEditor.addCompetency")}
                    isAvailable={isAvailableCompetency}
                    onChange={addRequirement}
                  />
                </div>
                {value.requirements.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-800">
                    {t("competencies.profileEditor.noRequirements")}
                  </p>
                ) : (
                  <CompetenciesProfileRequirementList
                    removeRequirement={removeRequirement}
                    updateRequirementLevel={updateRequirementLevel}
                    catalog={catalog}
                    isResolvingRequirements={isResolvingRequirements}
                    value={value}
                  />
                )}
              </div>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-neutral-200 px-6 py-4 sm:gap-0">
            {profile && (
              <Button
                type="button"
                variant="outline"
                className="text-error-700 sm:mr-auto"
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
              >
                {t("common.button.delete")}
              </Button>
            )}
            <Button type="button" variant="outline" disabled={isPending} onClick={close}>
              {t("competencies.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("competencies.save")}
            </Button>
          </DialogFooter>
        </form>
        <Dialog
          open={confirmDelete}
          onOpenChange={(open) => {
            if (!isPending) setConfirmDelete(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("competencies.deleteProfile")}</DialogTitle>
              <DialogDescription>
                {t(
                  assigned ? "competencies.profileInUse" : "competencies.deleteProfileConfirmation",
                  { name: profile?.name },
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  {t("competencies.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="button"
                disabled={isPending || assigned}
                onClick={async () => {
                  if (!profile) return;
                  try {
                    await execute({
                      operation: "delete_profile",
                      id: profile.id,
                      revision: profile.revision,
                    });
                    close();
                  } catch {
                    /* Retain the profile on failure. */
                  }
                }}
              >
                {t("common.button.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
