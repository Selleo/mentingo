type VoiceLevelBarsProps = {
  voiceLevel: number;
  barCount?: number;
  barClassName?: string;
  containerClassName?: string;
};

export function VoiceLevelBars({
  voiceLevel,
  barCount = 16,
  barClassName = "w-1.5 rounded-full bg-neutral-800 transition-all duration-200",
  containerClassName = "flex h-7 items-end gap-1",
}: VoiceLevelBarsProps) {
  const normalizedLevel = Number.isFinite(voiceLevel) ? Math.max(0, Math.min(1, voiceLevel)) : 0;
  const boostedLevel = Math.min(1, Math.pow(normalizedLevel, 0.45) * 1.2);

  return (
    <div className={containerClassName}>
      {Array.from({ length: barCount }, (_, index) => {
        const wave = 0.35 + 0.65 * Math.abs(Math.sin(index * 0.65));
        const height = 6 + Math.round(boostedLevel * 20 * wave);

        return <span key={index} className={barClassName} style={{ height: `${height}px` }} />;
      })}
    </div>
  );
}
