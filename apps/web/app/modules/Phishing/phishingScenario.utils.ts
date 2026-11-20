import type { TFunction } from "i18next";
import type { ListPhishingScenariosResponse } from "~/api/generated-api";

export type PhishingScenario = ListPhishingScenariosResponse["data"][number];

/**
 * The phishing service returns scenario copy in English only. Known scenarios are translated
 * by their ID; unknown ones fall back to the text supplied by the service.
 */
export const getLocalizedPhishingScenario = (scenario: PhishingScenario, t: TFunction) => ({
  name: t(`phishing.scenarios.${scenario.id}.name`, { defaultValue: scenario.name }),
  description: t(`phishing.scenarios.${scenario.id}.description`, {
    defaultValue: scenario.description,
  }),
});
