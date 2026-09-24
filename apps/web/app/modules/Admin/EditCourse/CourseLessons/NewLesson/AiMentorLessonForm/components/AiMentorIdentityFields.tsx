import { Camera, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FormTextField } from "~/components/Form/FormTextField";
import { Icon } from "~/components/Icon";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { FormField, FormItem } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";

import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { Control } from "react-hook-form";

type AiMentorIdentityFieldsProps = {
  control: Control<AiMentorLessonFormValues>;
  avatarPreview: string | null;
  canEditAvatar: boolean;
  onEditAvatar: () => void;
  onRemoveAvatar: () => void;
  baseLanguageTitle?: string;
  baseLanguageName?: string;
};

export const AiMentorIdentityFields = ({
  control,
  avatarPreview,
  canEditAvatar,
  onEditAvatar,
  onRemoveAvatar,
  baseLanguageTitle,
  baseLanguageName,
}: AiMentorIdentityFieldsProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col-reverse gap-2 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center">
          <span className="mr-1 text-red-500">*</span>
          <Label htmlFor="title" className="mr-2">
            {t("adminCourseView.curriculum.lesson.field.title")}
          </Label>
        </div>
        <FormTextField
          data-testid={AI_MENTOR_LESSON_FORM_HANDLES.TITLE_INPUT}
          control={control}
          name="title"
          id="title"
          placeholder={
            baseLanguageTitle || t("adminCourseView.curriculum.lesson.placeholder.title")
          }
          className="mb-4"
        />
      </div>

      <Separator orientation="vertical" className="lg:h-14" />

      <div className="flex gap-2">
        <div className="relative size-12">
          <Avatar
            className={cn("group size-12 overflow-hidden border-2 border-border transition", {
              "cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1": canEditAvatar,
              "border-dotted border-neutral-300": !avatarPreview && canEditAvatar,
            })}
            onClick={canEditAvatar ? onEditAvatar : undefined}
          >
            <AvatarImage src={avatarPreview ?? undefined} />
            <AvatarFallback>
              <Icon name="AiMentor" className="size-8 text-primary" />
            </AvatarFallback>
            {canEditAvatar && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-neutral-950 bg-opacity-70 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
                {t("common.button.edit")}
              </div>
            )}
          </Avatar>
          {canEditAvatar &&
            (avatarPreview ? (
              <button
                type="button"
                className="absolute -bottom-0 -left-0 flex size-4 items-center justify-center rounded-full bg-primary text-contrast shadow-md hover:opacity-80"
                onClick={onRemoveAvatar}
              >
                <Minus className="size-4" />
              </button>
            ) : (
              <div className="absolute -bottom-0 -left-0 flex size-4 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 shadow-md hover:opacity-80">
                <Camera className="size-3" />
              </div>
            ))}
        </div>

        <div className="flex flex-1 flex-col gap-1 lg:flex-0">
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between">
                  <Label className="text-sm text-muted-foreground">
                    {t("adminCourseView.curriculum.lesson.field.mentorName")}
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Icon name="Info" className="h-auto w-5 cursor-default text-neutral-400" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("adminCourseView.curriculum.lesson.other.aiMentorPersonaTooltip")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  </Tooltip>
                </div>

                <input
                  data-testid={AI_MENTOR_LESSON_FORM_HANDLES.NAME_INPUT}
                  type="text"
                  className="border-b bg-transparent text-sm outline-0"
                  value={field.value}
                  placeholder={baseLanguageName}
                  onChange={field.onChange}
                />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
};
