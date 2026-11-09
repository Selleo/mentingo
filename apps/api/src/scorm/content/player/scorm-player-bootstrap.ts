import {
  SCORM_12_API_METHODS,
  SCORM_12_RUNTIME_SETTINGS,
  SCORM_BRIDGE_CONFIG,
  SCORM_BRIDGE_MESSAGE_TYPES,
  SCORM_BRIDGE_METHODS,
  SCORM_PLAYER_ATTRIBUTES,
} from "@repo/shared";

import type {
  ScormPlayerApiMethod,
  ScormPlayerBootstrapConfig,
  ScormPlayerLaunchConfig,
  ScormPlayerWindow,
} from "./scorm-player.types";
import type { Scorm12API } from "scorm-again";

function bootstrap(config: ScormPlayerBootstrapConfig) {
  if (window.parent === window) return;

  const playerWindow = window as unknown as ScormPlayerWindow;
  const session = crypto.randomUUID();

  let sequence = 0;
  let initialized = false;
  let bridgeError: string | null = null;

  const bridgeMethods = Object.values(config.bridgeMethods);

  function postToParent(message: Record<string, unknown>) {
    window.parent.postMessage(
      { ...message, channel: config.channel, session },
      config.parentOrigin,
    );
  }

  function announceReady() {
    postToParent({ type: config.messages.READY });
  }

  function forwardCall(method: ScormPlayerApiMethod, params: string[]) {
    const forwardedParams =
      method === config.apiMethods.SET_VALUE
        ? [String(params[0]), String(params[1] ?? "")]
        : [String(params[0] ?? "")];

    postToParent({
      type: config.messages.CALL,
      sequence: ++sequence,
      method,
      params: forwardedParams,
    });
  }

  function wrapApiMethod(api: Scorm12API, method: ScormPlayerApiMethod) {
    return (...params: string[]) => {
      if (method === config.apiMethods.GET_LAST_ERROR && bridgeError) return bridgeError;

      const isBridgeMethod = bridgeMethods.some((allowed) => allowed === method);
      if (isBridgeMethod && api.isTerminated()) {
        bridgeError = "101";
        return "false";
      }

      if (
        method !== config.apiMethods.GET_ERROR_STRING &&
        method !== config.apiMethods.GET_DIAGNOSTIC
      ) {
        bridgeError = null;
      }

      const apiMethod = api[method as keyof Scorm12API] as (...args: string[]) => string;
      const result = apiMethod.apply(api, params);

      if (!isBridgeMethod) return result;
      if (result !== "true" || api.LMSGetLastError() !== "0") return "false";

      forwardCall(method, params);
      return result;
    };
  }

  function exposeRuntime(runtime: Parameters<Scorm12API["loadFromFlattenedJSON"]>[0]) {
    const api = new playerWindow.Scorm12API(config.settings);
    api.loadFromFlattenedJSON(runtime);
    playerWindow.API = Object.fromEntries(
      Object.values(config.apiMethods).map((method) => [method, wrapApiMethod(api, method)]),
    );
  }

  function mountContentFrame() {
    const frame = document.createElement("iframe");
    frame.title = "SCORM";
    frame.dataset.testid = config.playerAttributes.CONTENT_FRAME_TEST_ID;
    frame.setAttribute("sandbox", config.playerAttributes.SANDBOX);
    frame.referrerPolicy = config.playerAttributes.REFERRER_POLICY;
    frame.src = config.assetUrl;
    document.body.appendChild(frame);
  }

  function stopHandshake() {
    window.clearInterval(retry);
    window.clearTimeout(timeout);
    window.removeEventListener("message", onMessage);
  }

  function onMessage(event: MessageEvent) {
    if (initialized || event.origin !== config.parentOrigin || event.source !== window.parent)
      return;

    const data = event.data;
    if (
      data?.type !== config.messages.INITIALIZE ||
      data.channel !== config.channel ||
      data.session !== session
    )
      return;

    initialized = true;
    stopHandshake();
    exposeRuntime(data.runtime);
    mountContentFrame();
  }

  const retry = window.setInterval(announceReady, config.bridgeConfig.READY_RETRY_INTERVAL_MS);
  const timeout = window.setTimeout(
    () => window.clearInterval(retry),
    config.bridgeConfig.READY_TIMEOUT_MS,
  );
  window.addEventListener("message", onMessage);
  window.addEventListener("pagehide", stopHandshake, { once: true });
  announceReady();
}

export function renderScormBootstrap(config: ScormPlayerLaunchConfig) {
  return `(${bootstrap.toString()})(${JSON.stringify({
    ...config,
    messages: SCORM_BRIDGE_MESSAGE_TYPES,
    bridgeMethods: SCORM_BRIDGE_METHODS,
    bridgeConfig: SCORM_BRIDGE_CONFIG,
    apiMethods: SCORM_12_API_METHODS,
    playerAttributes: SCORM_PLAYER_ATTRIBUTES,
    settings: SCORM_12_RUNTIME_SETTINGS,
  })});`;
}
