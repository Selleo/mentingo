import { randomUserJourney } from "../tests/mixed-workload.test.js";
import { scenarioConfig } from "../../config/thresholds.js";

function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

export const options = {
  stages: [
    { duration: "2m", target: parseInt(getEnvVar("STRESS_TEST_INITIAL_VUS", "1000")) },
    {
      duration: getEnvVar("STRESS_TEST_STAGE_1_DURATION", "3m"),
      target: parseInt(getEnvVar("STRESS_TEST_STAGE_1_VUS", "5000")),
    },
    {
      duration: getEnvVar("STRESS_TEST_STAGE_2_DURATION", "3m"),
      target: parseInt(getEnvVar("STRESS_TEST_STAGE_2_VUS", "10000")),
    },
    {
      duration: getEnvVar("STRESS_TEST_STAGE_3_DURATION", "3m"),
      target: parseInt(getEnvVar("STRESS_TEST_STAGE_3_VUS", "15000")),
    },
    { duration: "3m", target: parseInt(getEnvVar("STRESS_TEST_MAX_VUS", "20000")) },
    { duration: getEnvVar("STRESS_TEST_RAMP_DOWN_DURATION", "2m"), target: 0 },
  ],

  thresholds: scenarioConfig.stress.thresholds,

  //Enable cookie jar for cookie-based authentication
  jar: true,
  cookies: {
    [getEnvVar("COOKIE_DOMAIN", "localhost")]: {},
  },

  ext: {
    loadimpact: {
      projectID: parseInt(getEnvVar("LOADIMPACT_PROJECT_ID", "3498765")),
      name: "Stress Test - Finding Breaking Point",
    },
  },
};

export default function stressTest() {
  randomUserJourney();
}
