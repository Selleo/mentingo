import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateRegistrationForm } from "~/api/mutations/admin/useUpdateRegistrationForm";
import { useAdminRegistrationForm } from "~/api/queries/admin/useAdminRegistrationForm";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

import {
  buildUpdateRegistrationFormBody,
  createEmptyField,
  registrationFormSchema,
} from "./registration-form-builder/registrationFormBuilder.utils";
import { RegistrationFormBuilderField } from "./registration-form-builder/RegistrationFormBuilderField";
import { SortableFieldCard } from "./registration-form-builder/SortableFieldCard";

import type { RegistrationFormValues } from "./registration-form-builder/registrationFormBuilder.utils";
import type { DragEndEvent } from "@dnd-kit/core";

export function RegistrationFormBuilder() {
  const { t } = useTranslation();
  const hydratedVersionRef = useRef<string | null>(null);
  const { data: registrationForm, isLoading } = useAdminRegistrationForm();

  const {
    mutate: updateRegistrationForm,
    mutateAsync: updateRegistrationFormAsync,
    isPending,
  } = useUpdateRegistrationForm();

  const {
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      fields: [],
    },
  });

  const watchedFields = useWatch({
    control,
    name: "fields",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const { fields, append } = useFieldArray({
    control,
    name: "fields",
    keyName: "fieldKey",
  });

  const visibleFields = fields.map((field, index) => ({
    field,
    index,
    isRequired: watchedFields?.[index]?.required ?? false,
  }));

  useEffect(() => {
    if (!registrationForm?.fields) return;

    const serializedFields = JSON.stringify(registrationForm.fields);

    if (hydratedVersionRef.current === serializedFields) return;

    hydratedVersionRef.current = serializedFields;

    reset({
      fields: registrationForm.fields.map((field) => ({
        ...field,
        type: "checkbox",
      })),
    });
  }, [registrationForm?.fields, reset]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !watchedFields) return;

    const fromVisibleIndex = visibleFields.findIndex(({ field }) => field.fieldKey === active.id);
    const toVisibleIndex = visibleFields.findIndex(({ field }) => field.fieldKey === over.id);

    if (fromVisibleIndex === -1 || toVisibleIndex === -1) return;

    const fromIndex = visibleFields[fromVisibleIndex]?.index;
    const toIndex = visibleFields[toVisibleIndex]?.index;

    if (fromIndex === undefined || toIndex === undefined) return;

    reset({
      fields: arrayMove(watchedFields, fromIndex, toIndex).map((field, index) => ({
        ...field,
        displayOrder: index,
      })),
    });
  };

  const handleArchive = async (index: number) => {
    const previousFields = getValues("fields");

    const nextFields = previousFields.map((field, currentIndex) =>
      currentIndex === index ? { ...field, archived: true } : field,
    );

    reset({ fields: nextFields });

    try {
      await updateRegistrationFormAsync(buildUpdateRegistrationFormBody(nextFields));
    } catch {
      reset({ fields: previousFields });
    }
  };

  const onSubmit = (values: RegistrationFormValues) => {
    updateRegistrationForm(buildUpdateRegistrationFormBody(values.fields));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="h5">{t("registrationFormBuilder.title")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("registrationFormBuilder.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Button type="button" onClick={() => append(createEmptyField(fields.length))}>
            <Plus className="mr-2 size-4" />
            {t("registrationFormBuilder.addField")}
          </Button>

          {isLoading && (
            <div className="body-sm rounded-lg bg-muted/40 px-4 py-6 text-muted-foreground">
              {t("registrationFormBuilder.loading")}
            </div>
          )}

          {!isLoading && visibleFields.length === 0 && (
            <div className="body-sm rounded-lg bg-muted/40 px-4 py-6 text-muted-foreground">
              {t("registrationFormBuilder.empty")}
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleFields.map(({ field }) => field.fieldKey)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {visibleFields.map(({ field, index, isRequired }, visibleIndex) => {
                  return (
                    <SortableFieldCard key={field.fieldKey} id={field.fieldKey}>
                      {({ attributes, listeners }) => (
                        <RegistrationFormBuilderField
                          control={control}
                          errors={errors}
                          index={index}
                          isArchiving={isPending}
                          isRequired={isRequired}
                          onArchive={handleArchive}
                          sortAttributes={attributes}
                          sortListeners={listeners}
                          visibleIndex={visibleIndex}
                        />
                      )}
                    </SortableFieldCard>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {t("registrationFormBuilder.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
