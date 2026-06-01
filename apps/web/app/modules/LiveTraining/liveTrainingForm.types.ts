import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";
import { z } from "zod";

export const liveTrainingFormStateSchema = z.object({
  title: z.string(),
  description: z.string(),
  allDay: z.boolean(),
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string(),
  endTime: z.string(),
  deliveryType: z.nativeEnum(LIVE_TRAINING_DELIVERY_TYPES),
  location: z.string(),
  maxParticipants: z.number(),
  microphoneEnabled: z.boolean(),
  cameraEnabled: z.boolean(),
});

export type LiveTrainingFormState = z.infer<typeof liveTrainingFormStateSchema>;

export type LiveTrainingFormFieldErrors = {
  title?: string;
  endsAt?: string;
};

export type LiveTrainingFormFieldUpdater = <Key extends keyof LiveTrainingFormState>(
  key: Key,
  value: LiveTrainingFormState[Key],
) => void;
