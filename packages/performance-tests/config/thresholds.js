function getThresholdValue(envVar, defaultValue) {
  return __ENV[envVar] !== undefined ? __ENV[envVar] : defaultValue;
}

export const thresholds = {
  http_req_duration: [
    `p(95)<${getThresholdValue("THRESHOLD_P95_MS", "500")}`,
    `p(99)<${getThresholdValue("THRESHOLD_P99_MS", "1000")}`,
    `max<${getThresholdValue("THRESHOLD_MAX_MS", "5000")}`,
  ],
  http_req_failed: [`rate<${getThresholdValue("THRESHOLD_ERROR_RATE", "0.01")}`],
  checks: [`rate>${getThresholdValue("THRESHOLD_CHECK_RATE", "0.99")}`],
};

export const slowThresholds = {
  http_req_duration: [
    `p(95)<${getThresholdValue("THRESHOLD_SLOW_P95_MS", "2000")}`,
    `p(99)<${getThresholdValue("THRESHOLD_SLOW_P99_MS", "5000")}`,
    `max<${getThresholdValue("THRESHOLD_SLOW_MAX_MS", "30000")}`,
  ],
  http_req_failed: [`rate<${getThresholdValue("THRESHOLD_SLOW_ERROR_RATE", "0.02")}`],
};

export const criticalThresholds = {
  http_req_duration: [
    `p(95)<${getThresholdValue("THRESHOLD_CRITICAL_P95_MS", "300")}`,
    `p(99)<${getThresholdValue("THRESHOLD_CRITICAL_P99_MS", "500")}`,
    `max<${getThresholdValue("THRESHOLD_CRITICAL_MAX_MS", "2000")}`,
  ],
  http_req_failed: [`rate<${getThresholdValue("THRESHOLD_CRITICAL_ERROR_RATE", "0.005")}`],
};

export function getThresholdsForCategory(category) {
  const criticalCategories = ["auth", "health", "login"];
  const slowCategories = ["ai", "ingestion", "file"];

  if (criticalCategories.includes(category)) {
    return criticalThresholds;
  }

  if (slowCategories.includes(category)) {
    return slowThresholds;
  }

  return thresholds;
}

export const scenarioConfig = {
  load: {
    name: "Load Test - 10k Sustained Users",
    thresholds,
  },
  stress: {
    name: "Stress Test - Find Breaking Point",
    thresholds: {
      ...thresholds,
      http_req_failed: ["rate<0.05"], // More lenient during stress
    },
  },
  spike: {
    name: "Spike Test - Sudden Surge",
    thresholds: {
      ...thresholds,
      http_req_duration: [
        "p(95)<1000", // More lenient for spike
        "p(99)<2000",
        "max<10000",
      ],
    },
  },
  soak: {
    name: "Soak Test - Extended Stability",
    thresholds,
  },
};

export default {
  thresholds,
  slowThresholds,
  criticalThresholds,
  scenarioConfig,
  getThresholdsForCategory,
};
