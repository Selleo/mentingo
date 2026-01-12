import { randomUserJourney } from "../tests/mixed-workload.test.js";
import { scenarioConfig } from "../../config/thresholds.js";

function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

export const options = {
  stages: [
    {
      duration: getEnvVar("LOAD_TEST_RAMP_UP_DURATION", "2m"),
      target: parseInt(getEnvVar("LOAD_TEST_MAX_VUS", "20")),
    },
    {
      duration: getEnvVar("LOAD_TEST_SUSTAIN_DURATION", "3m"),
      target: parseInt(getEnvVar("LOAD_TEST_MAX_VUS", "20")),
    },
    { duration: getEnvVar("LOAD_TEST_RAMP_DOWN_DURATION", "2m"), target: 0 },
  ],

  thresholds: scenarioConfig.load.thresholds,

  // Enable cookie jar for cookie-based authentication
  jar: true,
  cookies: {
    [getEnvVar("COOKIE_DOMAIN", "localhost")]: {},
  },

  // K6 Cloud configuration
  ext: {
    loadimpact: {
      projectID: parseInt(getEnvVar("K6_CLOUD_PROJECT_ID", "3498765")),
      name: getEnvVar("K6_CLOUD_TEST_NAME", "Mentingo Load Test - Sustained Users"),
      distribution: {
        "amazon:de:frankfurt": { loadZone: "amazon:de:frankfurt", percent: 100 },
      },
      note: getEnvVar(
        "K6_CLOUD_TEST_NOTE",
        "Load test with realistic user behavior - students, admins, and content creators",
      ),
    },
  },
};

export default function loadTest() {
  randomUserJourney();
}
