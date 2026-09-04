import { useCallback, useEffect, useState } from "react";

import { useLeaveModal } from "~/context/LeaveModalContext";

export function useLessonLeaveConfirmation(onLeave: () => void) {
  const {
    isLeaveModalOpen,
    closeLeaveModal,
    isCurrentFormDirty,
    setIsCurrectFormDirty,
    setIsLeavingContent,
    openLeaveModal,
  } = useLeaveModal();
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancel = useCallback(() => {
    if (isCurrentFormDirty) {
      setIsCanceling(true);
      setIsLeavingContent(true);
      openLeaveModal();
      return;
    }

    onLeave();
  }, [isCurrentFormDirty, onLeave, openLeaveModal, setIsLeavingContent]);

  useEffect(() => {
    if (!isCurrentFormDirty && isCanceling) {
      onLeave();
      setIsCanceling(false);
      setIsLeavingContent(false);
    }
  }, [isCanceling, isCurrentFormDirty, onLeave, setIsLeavingContent]);

  const onCancelLeaveModal = useCallback(() => {
    closeLeaveModal();
    setIsCanceling(false);
    setIsLeavingContent(false);
  }, [closeLeaveModal, setIsLeavingContent]);

  const onDiscardLeaveModal = useCallback(() => {
    closeLeaveModal();
    setIsCurrectFormDirty(false);
    setIsLeavingContent(false);
  }, [closeLeaveModal, setIsCurrectFormDirty, setIsLeavingContent]);

  return {
    handleCancel,
    isLeaveModalOpen,
    onCancelLeaveModal,
    onDiscardLeaveModal,
    setIsCurrectFormDirty,
  };
}
