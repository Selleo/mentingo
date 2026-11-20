import { createInstance } from "i18next";
import { beforeAll, describe, expect, it } from "vitest";

import { getLocalizedPhishingScenario } from "./phishingScenario.utils";

const i18n = createInstance();

describe("getLocalizedPhishingScenario", () => {
  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: {
        pl: {
          translation: {
            phishing: {
              scenarios: {
                "password-reset": { name: "Reset hasła", description: "Prośba o reset hasła" },
              },
            },
          },
        },
      },
    });
  });

  it("translates a known scenario by its ID", () => {
    const scenario = {
      id: "password-reset",
      name: "Password reset",
      description: "A request to reset the account password",
      action: "submitted" as const,
    };

    expect(getLocalizedPhishingScenario(scenario, i18n.t)).toEqual({
      name: "Reset hasła",
      description: "Prośba o reset hasła",
    });
  });

  it("falls back to the service copy for an unknown scenario", () => {
    const scenario = {
      id: "new-scenario",
      name: "New scenario",
      description: "Copy from the phishing service",
      action: "clicked" as const,
    };

    expect(getLocalizedPhishingScenario(scenario, i18n.t)).toEqual({
      name: "New scenario",
      description: "Copy from the phishing service",
    });
  });
});
