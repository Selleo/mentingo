import { Maximize, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

type FullscreenToggleButtonProps = {
  isAnyFullscreen: boolean;
  visible: boolean;
  onToggle: () => void;
  className?: string;
};

export const FullscreenToggleButton = ({
  isAnyFullscreen,
  visible,
  onToggle,
  className,
}: FullscreenToggleButtonProps) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={onToggle}
          initial={{ opacity: 0, y: -8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.94 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className={cn(
            "absolute right-4 top-4 z-20 flex aspect-square items-center justify-center rounded-md bg-primary-600 p-2 text-xs font-semibold text-contrast leading-none",
            className,
          )}
          aria-label={isAnyFullscreen ? t("common.exitFullscreen") : t("common.enterFullscreen")}
        >
          {isAnyFullscreen ? <X className="size-4" /> : <Maximize className="size-4" />}
        </motion.button>
      )}
    </AnimatePresence>
  );
};
