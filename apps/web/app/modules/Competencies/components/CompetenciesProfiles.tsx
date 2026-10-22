import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";

import { CompetenciesSelect } from "./CompetenciesSelect";

import type { CompetenciesWorkspace, CompetencyProfile } from "../competencies.types";

type ProfileInput = {
  name: string;
  description: string;
  requirements: { competencyId: string; levelId: string }[];
};
export function CompetenciesProfileEditor({
  profile,
  workspace,
  close,
}: {
  profile?: CompetencyProfile;
  workspace: CompetenciesWorkspace;
  close: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const assigned = workspace.subjects.some((subject) => subject.profileId === profile?.id);
  const [value, setValue] = useState<ProfileInput>({
    name: profile?.name ?? "",
    description: profile?.description ?? "",
    requirements: (profile?.requirements ?? []).map(({ competencyId, levelId }) => ({
      competencyId,
      levelId,
    })),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) close();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 py-5">
          <DialogTitle>{t("competencies.editProfile")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await execute({
                operation: "save_profile",
                id: profile?.id,
                revision: profile?.revision,
                value,
              });
              close();
            } catch {
              /* Retain the draft. */
            }
          }}
        >
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
              <div className="flex min-h-0 flex-col gap-2">
                <Label id="profile-requirements-label">
                  {t("competencies.requiredCompetencies")}
                </Label>
                <div
                  role="group"
                  aria-labelledby="profile-requirements-label"
                  className="max-h-80 overflow-y-auto rounded-lg border border-neutral-200 px-4"
                >
                  {workspace.catalog
                    .filter(
                      (item) =>
                        value.requirements.some(
                          (requirement) => requirement.competencyId === item.id,
                        ) ||
                        (!item.archived && item.levels.length > 0),
                    )
                    .map((competency) => {
                      const requirement = value.requirements.find(
                        (item) => item.competencyId === competency.id,
                      );
                      return (
                        <div key={competency.id} className="flex flex-col gap-3 border-t pt-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`profile-${competency.id}`}
                              checked={Boolean(requirement)}
                              onCheckedChange={(checked) =>
                                setValue({
                                  ...value,
                                  requirements:
                                    checked === true
                                      ? [
                                          ...value.requirements,
                                          {
                                            competencyId: competency.id,
                                            levelId: competency.levels[0]!.id,
                                          },
                                        ]
                                      : value.requirements.filter(
                                          (item) => item.competencyId !== competency.id,
                                        ),
                                })
                              }
                            />
                            <Label htmlFor={`profile-${competency.id}`}>{competency.name}</Label>
                            {competency.archived && (
                              <Badge variant="secondary">{t("competencies.archived")}</Badge>
                            )}
                          </div>
                          {requirement && !competency.archived && competency.levels.length > 0 && (
                            <div className="flex flex-wrap items-end gap-4">
                              <CompetenciesSelect
                                label={t("competencies.requiredLevel")}
                                value={requirement.levelId}
                                options={competency.levels.map((level) => ({
                                  value: level.id,
                                  label: level.name,
                                }))}
                                onChange={(levelId) =>
                                  setValue({
                                    ...value,
                                    requirements: value.requirements.map((item) =>
                                      item === requirement ? { ...item, levelId } : item,
                                    ),
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
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
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("competencies.deleteProfile")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  assigned ? "competencies.profileInUse" : "competencies.deleteProfileConfirmation",
                  { name: profile?.name },
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>{t("competencies.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending || assigned}
                onClick={async (event) => {
                  event.preventDefault();
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
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
export function CompetenciesProfiles({
  workspace,
  onEdit,
}: {
  workspace: CompetenciesWorkspace;
  onEdit: (profile: CompetencyProfile) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      {!workspace.profiles.length && (
        <p className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-800">
          {t("competencies.noProfiles")}
        </p>
      )}
      {workspace.profiles.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <Table aria-label={t("competencies.profiles")}>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead scope="col">{t("competencies.profile")}</TableHead>
                <TableHead scope="col">{t("competencies.requirements")}</TableHead>
                <TableHead scope="col">{t("competencies.person")}</TableHead>
                <TableHead scope="col">
                  <span className="sr-only">{t("competencies.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="min-w-48">
                    <span className="font-semibold">{profile.name}</span>
                  </TableCell>
                  <TableCell>{profile.requirements.length}</TableCell>
                  <TableCell>
                    {
                      workspace.subjects.filter((subject) => subject.profileId === profile.id)
                        .length
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onEdit(profile)}>
                        {t("competencies.edit")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
