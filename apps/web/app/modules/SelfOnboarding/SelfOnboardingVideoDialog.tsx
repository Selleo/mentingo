import HelpdeskVideoContent from "./SelfOnboardingVideoContent";
import { HelpdeskVideoDialogFrame } from "./SelfOnboardingVideoDialogFrame";

import type { HelpdeskSelection } from "./self-onboarding.types";

type Props = {
  selection: HelpdeskSelection;
  onClose: () => void;
  onRestoreFocus: () => void;
  onSelect: (selection: HelpdeskSelection) => void;
};

export default function HelpdeskVideoDialog({
  selection,
  onClose,
  onRestoreFocus,
  onSelect,
}: Props) {
  return (
    <HelpdeskVideoDialogFrame onClose={onClose} onRestoreFocus={onRestoreFocus}>
      <HelpdeskVideoContent selection={selection} onSelect={onSelect} />
    </HelpdeskVideoDialogFrame>
  );
}
