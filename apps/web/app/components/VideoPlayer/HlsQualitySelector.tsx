import { useEffect, useRef, useState } from "react";

import { getHlsQualityLabel, type HlsQualityOption, type HlsQualitySelection } from "./hlsQuality";

type HlsQualitySelectorProps = {
  options: HlsQualityOption[];
  selection: HlsQualitySelection;
  onSelect: (selection: HlsQualitySelection) => void;
};

export const HlsQualitySelector = ({ options, selection, onSelect }: HlsQualitySelectorProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointerDown);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    };
  }, [open]);

  if (!options.length) return null;

  return (
    <div ref={rootRef} className="mentingo-vjs-quality-selector">
      <button
        type="button"
        className="mentingo-vjs-quality-selector__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Video quality"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        {getHlsQualityLabel(selection, options)}
      </button>
      {open && (
        <div className="mentingo-vjs-quality-selector__menu" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={selection === option.value}
              className="mentingo-vjs-quality-selector__item"
              data-selected={selection === option.value}
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
