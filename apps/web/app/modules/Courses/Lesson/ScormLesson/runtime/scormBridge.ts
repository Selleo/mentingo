import {
  SCORM_BRIDGE_MESSAGE_TYPES,
  SCORM_BRIDGE_METHODS,
  SCORM_CONTENT_PATHS,
  SCORM_CONTENT_TOKEN,
} from "@repo/shared";
import { match } from "ts-pattern";

import { scormBridgeCallSchema, scormBridgeEnvelopeSchema } from "./scormBridge.schema";

import type { Scorm12API } from "scorm-again";

const contentTokenPattern = new RegExp(SCORM_CONTENT_TOKEN.PATTERN);
const playerPathPattern = new RegExp(
  `^${SCORM_CONTENT_PATHS.PREFIX}([^/]+)/${SCORM_CONTENT_PATHS.PLAYER}$`,
);

type ScormBridgeOptions = {
  api: Scorm12API;
  launchUrl: string;
  getFrame: () => Window | null | undefined;
};

export function getScormContentLocation(launchUrl: string) {
  const url = new URL(launchUrl);
  const channel = playerPathPattern.exec(url.pathname)?.[1];
  if (
    url.origin === window.location.origin ||
    url.protocol !== "https:" ||
    !channel ||
    !contentTokenPattern.test(channel)
  ) {
    throw new Error("SCORM requires an isolated content URL");
  }
  return { origin: url.origin, channel };
}

export function attachScormBridge({ api, launchUrl, getFrame }: ScormBridgeOptions) {
  const { origin, channel } = getScormContentLocation(launchUrl);
  let session: string | undefined;
  let sequence = 0;

  const initializeContentSession = (frame: Window, contentSession: string) => {
    if (session !== contentSession) {
      session = contentSession;
      sequence = 0;
    }

    frame.postMessage(
      {
        type: SCORM_BRIDGE_MESSAGE_TYPES.INITIALIZE,
        channel,
        session,
        runtime: api.getFlattenedCMI(),
      },
      origin,
    );
  };

  const forwardContentCall = (
    message: MessageEvent["data"],
    callSession: string,
    callSequence: number,
  ) => {
    if (!session || callSession !== session || callSequence !== sequence + 1) return;

    sequence = callSequence;

    const call = scormBridgeCallSchema.safeParse(message);
    if (!call.success) return;

    match(call.data)
      .with({ method: SCORM_BRIDGE_METHODS.SET_VALUE }, ({ params }) => api.LMSSetValue(...params))
      .otherwise(({ method }) => api[method](""));
  };

  const onMessage = (event: MessageEvent) => {
    const frame = getFrame();
    if (!frame || event.source !== frame || event.origin !== origin) return;

    const message = scormBridgeEnvelopeSchema.safeParse(event.data);
    if (!message.success || message.data.channel !== channel) return;

    match(message.data)
      .with({ type: SCORM_BRIDGE_MESSAGE_TYPES.READY }, ({ session: contentSession }) =>
        initializeContentSession(frame, contentSession),
      )
      .with(
        { type: SCORM_BRIDGE_MESSAGE_TYPES.CALL },
        ({ session: callSession, sequence: callSequence }) =>
          forwardContentCall(event.data, callSession, callSequence),
      )
      .exhaustive();
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
