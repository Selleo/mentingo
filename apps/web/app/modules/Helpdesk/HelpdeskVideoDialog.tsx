import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";

import { helpdeskTutorialLabel } from "./helpdesk.helpers";
import { HelpdeskRelatedTutorials } from "./HelpdeskRelatedTutorials";
import { HelpdeskTutorialPlayer } from "./HelpdeskTutorialPlayer";

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
  const { tutorial, startMs } = selection;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[92dvh] w-[calc(100vw-24px)] max-w-5xl gap-0 overflow-y-auto rounded-xl p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <div className="px-6 pb-4 pt-5 pr-12">
          <DialogTitle className="text-xl leading-snug">
            {helpdeskTutorialLabel(tutorial).title}
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-neutral-600">
            {tutorial.description}
          </DialogDescription>
        </div>
        <HelpdeskTutorialPlayer tutorial={tutorial} startMs={startMs} />
        <HelpdeskRelatedTutorials currentKey={tutorial.key} onSelect={onSelect} />
      </DialogContent>
    </Dialog>
  );
}
