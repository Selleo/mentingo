import HelpdeskVideoContent from "./HelpdeskVideoContent";
import { HelpdeskVideoDialogFrame } from "./HelpdeskVideoDialogFrame";

import type { HelpdeskSelection } from "./helpdesk.types";

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
