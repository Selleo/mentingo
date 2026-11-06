import type {
  SCORM_12_API_METHODS,
  SCORM_12_RUNTIME_SETTINGS,
  SCORM_BRIDGE_CONFIG,
  SCORM_BRIDGE_MESSAGE_TYPES,
  SCORM_BRIDGE_METHODS,
  SCORM_PLAYER_ATTRIBUTES,
} from "@repo/shared";
import type { Scorm12API } from "scorm-again";

export type ScormPlayerApiMethod = (typeof SCORM_12_API_METHODS)[keyof typeof SCORM_12_API_METHODS];

export type ScormPlayerLaunchConfig = {
  parentOrigin: string;
  assetUrl: string;
  channel: string;
};

export type ScormPlayerBootstrapConfig = ScormPlayerLaunchConfig & {
  messages: typeof SCORM_BRIDGE_MESSAGE_TYPES;
  bridgeMethods: typeof SCORM_BRIDGE_METHODS;
  bridgeConfig: typeof SCORM_BRIDGE_CONFIG;
  apiMethods: typeof SCORM_12_API_METHODS;
  playerAttributes: typeof SCORM_PLAYER_ATTRIBUTES;
  settings: typeof SCORM_12_RUNTIME_SETTINGS;
};

export type ScormPlayerWindow = Window & {
  Scorm12API: typeof Scorm12API;
  API?: Record<string, (...args: string[]) => string>;
};
