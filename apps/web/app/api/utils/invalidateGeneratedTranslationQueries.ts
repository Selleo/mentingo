import { AI_JUDGE_CONFIGURATION_QUERY_KEY } from "~/api/queries/admin/useAiJudgeConfiguration";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_TRANSLATIONS_QUERY_KEY } from "~/api/queries/admin/useHasMissingTranslations";
import { queryClient } from "~/api/queryClient";

import type { SupportedLanguages } from "@repo/shared";

type GenerateTranslationsOptions = {
  courseId: string;
  language: SupportedLanguages;
};

export const invalidateGeneratedTranslationQueries = async ({
  courseId,
  language,
}: GenerateTranslationsOptions) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [COURSE_QUERY_KEY, { id: courseId, language }],
    }),
    queryClient.invalidateQueries({
      queryKey: [COURSE_TRANSLATIONS_QUERY_KEY, { id: courseId, language }],
    }),
    queryClient.invalidateQueries({
      queryKey: AI_JUDGE_CONFIGURATION_QUERY_KEY,
    }),
  ]);
};
