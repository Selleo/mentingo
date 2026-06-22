import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
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
  isFinishingSession: boolean;
  onFinishSession: () => Promise<void>;
  onLeave: (input: { userInitiated: boolean }) => void;
};

export type LiveTrainingRoomToolbarProps = {
  credentials: LiveTrainingMeetingCredentials;
  isFinishingSession: boolean;
  onOpenMaterials: () => void;
  onFinishSession: () => Promise<void>;
  onUserLeave: () => void;
};

export type LiveTrainingParticipantGridProps = {
  liveTrainingId: string;
  hasPinnedTrack: boolean;
  onTrackSelect: (trackRef: TrackReferenceOrPlaceholder, profilePictureUrl?: string | null) => void;
};

export type LiveTrainingFullscreenTrackOverlayProps = {
  profilePictureUrl?: string | null;
  trackRef: TrackReferenceOrPlaceholder | null;
  onClose: () => void;
};
