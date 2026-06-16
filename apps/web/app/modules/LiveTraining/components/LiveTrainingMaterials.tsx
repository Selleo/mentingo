import { LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES, LIVE_TRAINING_STATUSES } from "@repo/shared";
import { Download, Folder, Loader2, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteLiveTrainingResource } from "~/api/mutations/live-training/useDeleteLiveTrainingResource";
import { useOpenLiveTrainingResource } from "~/api/mutations/live-training/useOpenLiveTrainingResource";
import { useUploadLiveTrainingResource } from "~/api/mutations/live-training/useUploadLiveTrainingResource";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { LIVE_TRAINING_FILE_TABS } from "~/modules/LiveTraining/liveTraining.types";
import { getReadableFileTypeLabel } from "~/utils/fileDisplay";

import { LIVE_TRAINING_HANDLES } from "../../../../e2e/data/live-training/handles";

import type { LiveTrainingResourceRelationshipType } from "@repo/shared";
import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";

type LiveTrainingMaterialsProps = {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
};

type LiveTrainingMaterial = LiveTrainingDetails["materials"]["before"][number];

type MaterialCardProps = {
  material: LiveTrainingMaterial;
  isRemoving: boolean;
  canEditMaterials: boolean;
  testId: string;
  onOpen: () => void;
  onRemove: () => void;
};

type MaterialsSectionProps = {
  title: string;
  materials: LiveTrainingMaterial[];
  relationshipType: LiveTrainingResourceRelationshipType;
  fileInputTestId: string;
  materialCardTestId: (resourceId: string) => string;
  canEditMaterials: boolean;
  isUploading: boolean;
  isRemoving: boolean;
  onUpload: (
    files: FileList | null,
    relationshipType: LiveTrainingResourceRelationshipType,
  ) => void;
  onOpen: (material: LiveTrainingMaterial) => void;
  onRemove: (resourceId: string) => void;
};

function MaterialCard({
  material,
  isRemoving,
  canEditMaterials,
  testId,
  onOpen,
  onRemove,
}: MaterialCardProps) {
  const { t } = useTranslation();
  const size = material.size
    ? t("liveTrainingView.files.sizeInMb", {
        size: (material.size / (1024 * 1024)).toFixed(material.size >= 10 * 1024 * 1024 ? 0 : 1),
      })
    : null;

  return (
    <div
      data-testid={testId}
      className="group/material relative flex min-h-28 min-w-0 flex-col justify-between rounded-md border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/40"
    >
      <div className="min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-600">
            <Folder className="size-4" />
          </span>
          <Badge variant="outline" fontWeight="normal" className="rounded px-2 py-0.5 text-xs">
            {getReadableFileTypeLabel(material.contentType)}
          </Badge>
        </div>
        <p
          className="truncate text-sm font-medium leading-5 text-neutral-950"
          title={material.title}
        >
          {material.title}
        </p>
        {size && <p className="mt-1 text-xs text-neutral-500">{size}</p>}
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-fit gap-1.5 px-2 text-xs text-neutral-600 hover:text-primary-700"
          onClick={onOpen}
        >
          <Download className="size-3.5" />
          {t("liveTrainingView.files.download")}
        </Button>
      </div>

      {canEditMaterials && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="absolute right-2 top-2 size-7 bg-white/90 opacity-100 shadow-sm sm:opacity-0 sm:group-hover/material:opacity-100"
          disabled={isRemoving}
          aria-label={t("liveTrainingView.files.removeFile", { title: material.title })}
          onClick={onRemove}
        >
          {isRemoving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}

function AddMaterialTile({
  title,
  isUploading,
  inputTestId,
  onFilesSelected,
}: {
  title: string;
  isUploading: boolean;
  inputTestId: string;
  onFilesSelected: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        data-testid={inputTestId}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 bg-white p-3 text-sm text-neutral-500 transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 focus-visible:border-primary-500 focus-visible:bg-primary-50 focus-visible:text-primary-700 focus-visible:outline-none"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        <span>{title}</span>
      </button>
    </>
  );
}

function MaterialsSection({
  title,
  materials,
  relationshipType,
  fileInputTestId,
  materialCardTestId,
  canEditMaterials,
  isUploading,
  isRemoving,
  onUpload,
  onOpen,
  onRemove,
}: MaterialsSectionProps) {
  const { t } = useTranslation();

  if (!canEditMaterials && materials.length === 0) return null;

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
        <Badge variant="outline" fontWeight="normal" className="rounded px-2 py-0.5 text-xs">
          {materials.length}
        </Badge>
      </div>

      <div className="max-h-[22rem] overflow-y-auto pr-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
          {materials.map((material) => (
            <MaterialCard
              key={material.resourceId}
              material={material}
              testId={materialCardTestId(material.resourceId)}
              isRemoving={isRemoving}
              canEditMaterials={canEditMaterials}
              onOpen={() => onOpen(material)}
              onRemove={() => onRemove(material.resourceId)}
            />
          ))}
          {canEditMaterials && (
            <AddMaterialTile
              title={t("liveTrainingView.files.addFile")}
              isUploading={isUploading}
              inputTestId={fileInputTestId}
              onFilesSelected={(files) => onUpload(files, relationshipType)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function LiveTrainingMaterials({ liveTraining, actions }: LiveTrainingMaterialsProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { mutateAsync: uploadResource, isPending: isUploading } = useUploadLiveTrainingResource();
  const { mutate: openResource } = useOpenLiveTrainingResource();
  const { mutate: deleteResource, isPending: isRemoving } = useDeleteLiveTrainingResource();
  const isAfterTabLocked =
    !actions.canViewAllMaterials && liveTraining.status !== LIVE_TRAINING_STATUSES.ENDED;

  const handleUpload = async (
    files: FileList | null,
    relationshipType: LiveTrainingResourceRelationshipType,
  ) => {
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      await uploadResource({
        liveTrainingId: liveTraining.id,
        file,
        relationshipType,
        language,
      });
    }
  };

  const handleOpen = (material: LiveTrainingMaterial) => {
    openResource({
      liveTrainingId: liveTraining.id,
      resourceId: material.resourceId,
      language,
      filename: material.title,
    });
  };

  const handleRemove = (resourceId: string) => {
    deleteResource({ liveTrainingId: liveTraining.id, resourceId, language });
  };

  return (
    <Tabs defaultValue={LIVE_TRAINING_FILE_TABS.BEFORE} className="grid gap-4">
      <TabsList className="h-auto w-fit bg-neutral-100 p-1">
        <TabsTrigger
          value={LIVE_TRAINING_FILE_TABS.BEFORE}
          data-testid={LIVE_TRAINING_HANDLES.BEFORE_FILES_TAB}
        >
          {t("liveTrainingView.files.beforeHeading")}
        </TabsTrigger>
        <TabsTrigger
          value={LIVE_TRAINING_FILE_TABS.AFTER}
          disabled={isAfterTabLocked}
          data-testid={LIVE_TRAINING_HANDLES.AFTER_FILES_TAB}
        >
          {t("liveTrainingView.files.afterHeading")}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value={LIVE_TRAINING_FILE_TABS.BEFORE}
        data-testid={LIVE_TRAINING_HANDLES.BEFORE_FILES_PANEL}
      >
        <MaterialsSection
          title={t("liveTrainingView.files.beforeHeading")}
          materials={liveTraining.materials.before}
          relationshipType={LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE}
          fileInputTestId={LIVE_TRAINING_HANDLES.BEFORE_FILE_INPUT}
          materialCardTestId={LIVE_TRAINING_HANDLES.beforeFileCard}
          canEditMaterials={actions.canEditMaterials}
          isUploading={isUploading}
          isRemoving={isRemoving}
          onUpload={handleUpload}
          onOpen={handleOpen}
          onRemove={handleRemove}
        />
      </TabsContent>

      <TabsContent
        value={LIVE_TRAINING_FILE_TABS.AFTER}
        data-testid={LIVE_TRAINING_HANDLES.AFTER_FILES_PANEL}
      >
        <MaterialsSection
          title={t("liveTrainingView.files.afterHeading")}
          materials={liveTraining.materials.after}
          relationshipType={LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER}
          fileInputTestId={LIVE_TRAINING_HANDLES.AFTER_FILE_INPUT}
          materialCardTestId={LIVE_TRAINING_HANDLES.afterFileCard}
          canEditMaterials={actions.canEditMaterials}
          isUploading={isUploading}
          isRemoving={isRemoving}
          onUpload={handleUpload}
          onOpen={handleOpen}
          onRemove={handleRemove}
        />
      </TabsContent>
    </Tabs>
  );
}
