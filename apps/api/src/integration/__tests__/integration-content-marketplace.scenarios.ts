export const MARKETPLACE_CONNECTION = {
  baseUrl: "https://marketplace.example.test/",
  apiKey: "test-marketplace-key-".repeat(3),
} as const;

export const MARKETPLACE_ORIGIN = "https://marketplace.example.test";

export const INVALID_ORIGIN_CASES = [
  { reason: "is not a URL", baseUrl: "marketplace.example.test" },
  { reason: "uses plain HTTP outside localhost", baseUrl: "http://marketplace.example.test" },
  { reason: "has a path", baseUrl: "https://marketplace.example.test/marketplace" },
  { reason: "has a query", baseUrl: "https://marketplace.example.test/?tenant=1" },
  { reason: "carries credentials", baseUrl: "https://operator:secret@marketplace.example.test" },
];

export const REACHABLE_PLUGIN_CASES = [
  { enabled: true, body: { capabilities: { contentMarketplace: { enabled: true } } } },
  { enabled: false, body: { capabilities: { contentMarketplace: { enabled: false } } } },
];

export const UNREACHABLE_PLUGIN_CASES = [
  { reason: "rejects the API key", status: 401, body: { error: "unauthorized" } },
  { reason: "fails", status: 500, body: { error: "internal" } },
  { reason: "answers without the marketplace capability", status: 200, body: { capabilities: {} } },
];

export const CONFIGURATION_PATH = "/marketplace/v1/configuration";
