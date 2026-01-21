import { randomUserJourney } from "../tests/mixed-workload.test.js";
import { scenarioConfig } from "../../config/thresholds.js";

function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

export const options = {
  stages: [
    {
      duration: getEnvVar("SOAK_TEST_RAMP_UP_DURATION", "5m"),
      target: parseInt(getEnvVar("SOAK_TEST_VUS", "5000")),
    },
    {
      duration: getEnvVar("SOAK_TEST_SUSTAIN_DURATION", "120m"),
      target: parseInt(getEnvVar("SOAK_TEST_VUS", "5000")),
    },
    { duration: getEnvVar("SOAK_TEST_RAMP_DOWN_DURATION", "5m"), target: 0 },
  ],

  thresholds: scenarioConfig.soak.thresholds,

  //Enable cookie jar for cookie-based authentication
  jar: true,
  cookies: {
    [getEnvVar("COOKIE_DOMAIN", "localhost")]: {},
  },

  ext: {
    loadimpact: {
      projectID: parseInt(getEnvVar("LOADIMPACT_PROJECT_ID", "3498765")),
      name: "Soak Test - Extended Stability",
    },
  },
};

export default function soakTest() {
  randomUserJourney();
}
