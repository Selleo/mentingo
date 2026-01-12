import { randomUserJourney } from "../tests/mixed-workload.test.js";
import { scenarioConfig } from "../../config/thresholds.js";

function getEnvVar(key, defaultValue) {
  return __ENV[key] !== undefined ? __ENV[key] : defaultValue;
}

export const options = {
  stages: [
    { duration: "30s", target: parseInt(getEnvVar("SPIKE_TEST_INITIAL_VUS", "100")) },
    {
      duration: getEnvVar("SPIKE_TEST_SPIKE_DURATION", "30s"),
      target: parseInt(getEnvVar("SPIKE_TEST_SPIKE_VUS", "10000")),
    },
    {
      duration: getEnvVar("SPIKE_TEST_HOLD_DURATION", "1m"),
      target: parseInt(getEnvVar("SPIKE_TEST_SPIKE_VUS", "10000")),
    },
    { duration: getEnvVar("SPIKE_TEST_DROP_DURATION", "1m"), target: 100 },
    { duration: getEnvVar("SPIKE_TEST_RAMP_DOWN_DURATION", "10s"), target: 0 },
  ],

  thresholds: scenarioConfig.spike.thresholds,

  //Enable cookie jar for cookie-based authentication
  jar: true,
  cookies: {
    [getEnvVar("COOKIE_DOMAIN", "localhost")]: {},
  },

  ext: {
    loadimpact: {
      projectID: parseInt(getEnvVar("LOADIMPACT_PROJECT_ID", "3498765")),
      name: "Spike Test - Sudden Traffic Surge",
    },
  },
};

export default function spikeTest() {
  randomUserJourney();
}
