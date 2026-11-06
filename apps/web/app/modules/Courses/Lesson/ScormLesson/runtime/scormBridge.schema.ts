import {
  SCORM_BRIDGE_CONFIG,
  SCORM_BRIDGE_MESSAGE_TYPES,
  SCORM_BRIDGE_METHODS,
} from "@repo/shared";
import { z } from "zod";

export const scormBridgeCallSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal(SCORM_BRIDGE_METHODS.INITIALIZE),
    params: z.tuple([z.literal("")]),
  }),
  z.object({ method: z.literal(SCORM_BRIDGE_METHODS.COMMIT), params: z.tuple([z.literal("")]) }),
  z.object({ method: z.literal(SCORM_BRIDGE_METHODS.FINISH), params: z.tuple([z.literal("")]) }),
  z.object({
    method: z.literal(SCORM_BRIDGE_METHODS.SET_VALUE),
    params: z.tuple([
      z.string().max(SCORM_BRIDGE_CONFIG.MAX_KEY_LENGTH),
      z.string().max(SCORM_BRIDGE_CONFIG.MAX_VALUE_LENGTH),
    ]),
  }),
]);

const bridgeEnvelopeSchema = z.object({
  channel: z.string(),
  session: z.string().regex(new RegExp(SCORM_BRIDGE_CONFIG.SESSION_PATTERN)),
});

const bridgeReadySchema = bridgeEnvelopeSchema.extend({
  type: z.literal(SCORM_BRIDGE_MESSAGE_TYPES.READY),
});

const bridgeCallEnvelopeSchema = bridgeEnvelopeSchema.extend({
  type: z.literal(SCORM_BRIDGE_MESSAGE_TYPES.CALL),
  sequence: z.number(),
});

export const scormBridgeEnvelopeSchema = z.discriminatedUnion("type", [
  bridgeReadySchema,
  bridgeCallEnvelopeSchema,
]);
