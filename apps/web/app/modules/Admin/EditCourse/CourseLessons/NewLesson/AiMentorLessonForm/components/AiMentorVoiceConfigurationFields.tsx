import { AI_MENTOR_TTS_PRESET, AI_MENTOR_VOICE_MODE } from "@repo/shared";
import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { AiMentorLessonFormValues } from "../validators/useAiMentorLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

type AiMentorVoiceConfigurationFieldsProps = {
  form: UseFormReturn<AiMentorLessonFormValues>;
  tooltipKey: string;
};

export const AiMentorVoiceConfigurationFields = ({
  form,
  tooltipKey,
}: AiMentorVoiceConfigurationFieldsProps) => {
  const { t } = useTranslation();
  const selectedVoiceMode = useWatch({ control: form.control, name: "voiceMode" });

  return (
    <div className="mb-4 rounded-lg border border-input bg-background p-4">
      <div className="mb-4 flex items-center gap-1">
        <Label>{t("adminCourseView.curriculum.lesson.field.voiceConfig")}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex size-9 items-center justify-center">
              <Icon name="Info" className="h-auto w-6 text-neutral-800" />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
          >
            {t(tooltipKey)}
            <TooltipArrow className="fill-black" />
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="voiceMode"
          render={({ field }) => (
            <FormItem>
              <Label>{t("adminCourseView.curriculum.lesson.field.voiceMode")}</Label>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={AI_MENTOR_VOICE_MODE.PRESET}>
                    {t("adminCourseView.curriculum.lesson.other.voiceModePreset")}
                  </SelectItem>
                  <SelectItem value={AI_MENTOR_VOICE_MODE.CUSTOM}>
                    {t("adminCourseView.curriculum.lesson.other.voiceModeCustom")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className={cn(selectedVoiceMode === AI_MENTOR_VOICE_MODE.PRESET ? "block" : "hidden")}>
          <FormField
            control={form.control}
            name="ttsPreset"
            render={({ field }) => (
              <FormItem>
                <Label>{t("adminCourseView.curriculum.lesson.field.ttsPreset")}</Label>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={AI_MENTOR_TTS_PRESET.MALE}>
                      {t("adminCourseView.curriculum.lesson.other.voicePresetMale")}
                    </SelectItem>
                    <SelectItem value={AI_MENTOR_TTS_PRESET.FEMALE}>
                      {t("adminCourseView.curriculum.lesson.other.voicePresetFemale")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className={cn(selectedVoiceMode === AI_MENTOR_VOICE_MODE.CUSTOM ? "block" : "hidden")}>
          <FormField
            control={form.control}
            name="customTtsReference"
            render={({ field }) => (
              <FormItem>
                <Label>{t("adminCourseView.curriculum.lesson.field.customTTSReference")}</Label>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    className="bg-white"
                    placeholder={t(
                      "adminCourseView.curriculum.lesson.placeholder.customTTSReference",
                    )}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
};
