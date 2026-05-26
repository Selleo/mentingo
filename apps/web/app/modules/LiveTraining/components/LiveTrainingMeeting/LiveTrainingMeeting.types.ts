import type { JoinCurrentSessionResponse } from "~/api/generated-api";
import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";

export type LiveTrainingMeetingCredentials = JoinCurrentSessionResponse["data"];

export type LiveTrainingMeetingPreviewProps = {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
  isJoining: boolean;
  onJoin: () => void;
};

export type LiveTrainingRoomProps = {
  credentials: LiveTrainingMeetingCredentials;
  liveTraining: LiveTrainingDetails;
  canViewAllMaterials: boolean;
  onLeave: () => void;
};

export type LiveTrainingRoomToolbarProps = {
  credentials: LiveTrainingMeetingCredentials;
  onOpenMaterials: () => void;
};
