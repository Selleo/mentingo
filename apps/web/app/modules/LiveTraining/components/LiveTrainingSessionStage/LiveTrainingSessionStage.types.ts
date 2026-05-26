import type { LiveTrainingEditFormState } from "../../liveTrainingEdit.types";
import type { ReactNode } from "react";
import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";

export type UpdateLiveTrainingEditFormState = <Key extends keyof LiveTrainingEditFormState>(
  key: Key,
  value: LiveTrainingEditFormState[Key],
) => void;

export type InlineEditableProps = {
  children: ReactNode;
  className?: string;
  variant?: "text" | "chip";
};

export type PreviewMetaItemProps = {
  icon?: ReactNode;
  value: ReactNode;
  tooltip: string;
  canEdit?: boolean;
};

export type StageActionButtonProps = {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
};

export type LiveTrainingSessionStageLogicParams = {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
  editFormState: LiveTrainingEditFormState | null;
  onEditFormStateChange: UpdateLiveTrainingEditFormState;
  onEditFormStateCommit: (nextFormState: LiveTrainingEditFormState) => void;
};
