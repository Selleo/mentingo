import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";

export type LiveTrainingEditFormState = {
  title: string;
  description: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  deliveryType: LiveTrainingDetails["deliveryType"];
  location: string;
  maxParticipants: string;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
};
