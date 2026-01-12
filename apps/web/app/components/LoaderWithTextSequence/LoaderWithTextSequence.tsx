import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import Loader from "~/modules/common/Loader/Loader";

const PRESETS_PREFIX = "common.loader.textSequence";

const PRESETS = {
  aiMentor: [
    { time: 5000, text: "aiMentor.warmingUp" },
    { time: 5000, text: "aiMentor.preparingSimulation" },
    { time: 5000, text: "aiMentor.buildingContext" },
    { time: 0, text: "aiMentor.takingLonger" },
  ],
} as const;

type Props =
  | {
      textsSequence: Array<{
        time: number;
        text: string;
      }>;
      preset?: never;
    }
  | {
      preset: keyof typeof PRESETS;
      textsSequence?: never;
    };

export const LoaderWithTextSequence = (props: Props) => {
  const textsSequence = props.preset ? PRESETS[props.preset] : props.textsSequence;
  const isPreset = !!props.preset;
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const { t } = useTranslation(undefined, { keyPrefix: PRESETS_PREFIX });

  useEffect(() => {
    if (!textsSequence || textsSequence.length === 0) {
      setCurrentTextIndex(0);
      return;
    }
    setCurrentTextIndex(0);
  }, [textsSequence]);

  useEffect(() => {
    if (!textsSequence || textsSequence.length === 0) return;

    const currentItem = textsSequence[currentTextIndex];
    if (!currentItem) return;

    const nextIndex = currentTextIndex + 1;
    const hasNext = nextIndex < textsSequence.length;

    if (!hasNext) return;

    const timeout = setTimeout(() => {
      setCurrentTextIndex(nextIndex);
    }, currentItem.time);

    return () => {
      clearTimeout(timeout);
    };
  }, [currentTextIndex, textsSequence]);

  const currentTextKey = textsSequence?.[currentTextIndex]?.text;
  const currentText = isPreset ? t(currentTextKey) : currentTextKey;

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4">
      <Loader />
      <AnimatePresence mode="wait">
        {currentText && (
          <motion.p
            key={currentText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-base"
          >
            {currentText}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};
