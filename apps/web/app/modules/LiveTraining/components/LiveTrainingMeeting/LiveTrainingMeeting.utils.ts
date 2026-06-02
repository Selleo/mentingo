import { LIVE_TRAINING_PARTICIPANT_ROLES } from "@repo/shared";

import type { LiveTrainingMeetingCredentials } from "./LiveTrainingMeeting.types";

export const canPublishMicrophone = (credentials: LiveTrainingMeetingCredentials) =>
  credentials.role !== LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER ||
  credentials.viewerPermissions.microphoneEnabled;

export const canPublishCamera = (credentials: LiveTrainingMeetingCredentials) =>
  credentials.role !== LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER ||
  credentials.viewerPermissions.cameraEnabled;

export const canPublishScreenShare = (credentials: LiveTrainingMeetingCredentials) =>
  credentials.role !== LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER;
