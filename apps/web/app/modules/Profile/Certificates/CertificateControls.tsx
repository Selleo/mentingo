import * as PopoverPrimitive from "@radix-ui/react-popover";
import { HEX_COLOR_REGEX } from "@repo/shared";
import { Download, Loader2, Palette, X } from "lucide-react";
import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { useTranslation } from "react-i18next";

import { Linkedin } from "~/assets/svgs";
import RectangularSwitch from "~/components/RectangularSwitch";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import { applyUniformCertificateColor } from "./certificateTheme";

import type { CertificateColorTheme } from "./certificateTheme";

interface CertificateControlsProps {
  onClose?: () => void;
  languageToggled: boolean;
  setLanguageToggled: (languageToggled: boolean) => void;
  downloadCertificatePdf: () => Promise<void>;
  isPreparingDownload: boolean;
  onShareToLinkedIn?: () => Promise<void>;
  isPreparingShare?: boolean;
  colorTheme: CertificateColorTheme;
  setColorTheme: React.Dispatch<React.SetStateAction<CertificateColorTheme>>;
  onColorChange?: (color: string) => void;
  onColorPickerOpenChange?: (isOpen: boolean) => void;
  showColorPicker?: boolean;
  showDownloadButton?: boolean;
  showShareButton?: boolean;
}

const buttonClasses =
  "flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700";

const CertificateControls = ({
  onClose,
  languageToggled,
  setLanguageToggled,
  downloadCertificatePdf,
  isPreparingDownload,
  onShareToLinkedIn,
  isPreparingShare = false,
  colorTheme,
  setColorTheme,
  onColorChange,
  onColorPickerOpenChange,
  showColorPicker = false,
  showDownloadButton = true,
  showShareButton = false,
}: CertificateControlsProps) => {
  const { t } = useTranslation();
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  useEffect(() => {
    return () => onColorPickerOpenChange?.(false);
  }, [onColorPickerOpenChange]);

  const handleDownload = () => {
    void downloadCertificatePdf();
  };

  const handleColorPickerOpenChange = (isOpen: boolean) => {
    setIsColorPickerOpen(isOpen);
    onColorPickerOpenChange?.(isOpen);
  };

  const updateAllColors = (value: string) => {
    setColorTheme((previous) => applyUniformCertificateColor(value, previous));
    onColorChange?.(value);
  };

  const handleHexColorInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.startsWith("#")
      ? event.target.value
      : `#${event.target.value}`;

    if (HEX_COLOR_REGEX.test(value)) updateAllColors(value);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <RectangularSwitch
        switchLabel={t("studentCertificateView.controls.languageToggle")}
        onLabel="PL"
        offLabel="EN"
        toggled={languageToggled}
        setToggled={setLanguageToggled}
      />

      {showColorPicker && (
        <PopoverPrimitive.Root open={isColorPickerOpen} onOpenChange={handleColorPickerOpenChange}>
          <PopoverPrimitive.Trigger asChild>
            <Button
              size="sm"
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Palette className="size-4" />
              <span className="block mr-3">{t("studentCertificateView.controls.fontColor")}</span>
              <span
                className="size-4 rounded border border-gray-300"
                style={{ backgroundColor: colorTheme.titleColor }}
              />
              <span className="font-mono uppercase">{colorTheme.titleColor}</span>
            </Button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Content
            align="end"
            sideOffset={8}
            className={cn(
              "z-[60] w-[260px] rounded-lg border bg-white p-3 text-popover-foreground shadow-md outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <HexColorPicker color={colorTheme.titleColor} onChange={updateAllColors} />
              <div className="flex items-center justify-center space-x-1">
                <span className="text-sm text-gray-500">#</span>
                <Input
                  type="text"
                  value={colorTheme.titleColor.replace(/^#/, "").toLowerCase()}
                  onChange={handleHexColorInputChange}
                  className="w-24"
                />
              </div>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Root>
      )}

      {showDownloadButton && (
        <button
          className={buttonClasses}
          onClick={handleDownload}
          disabled={isPreparingDownload}
          aria-label={t("studentCertificateView.button.download")}
        >
          {isPreparingDownload ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Download className="size-5" />
          )}
        </button>
      )}
      {showShareButton && (
        <button
          className={buttonClasses}
          onClick={() => void onShareToLinkedIn?.()}
          disabled={isPreparingShare}
          aria-label={t("studentCertificateView.button.shareLinkedIn")}
        >
          {isPreparingShare ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Linkedin className="size-5" />
          )}
        </button>
      )}
      {onClose && (
        <button className={buttonClasses} onClick={onClose}>
          <X className="size-5" />
        </button>
      )}
    </div>
  );
};

export default CertificateControls;
