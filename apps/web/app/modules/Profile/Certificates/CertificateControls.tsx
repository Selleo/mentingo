import { Download, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import RectangularSwitch from "~/components/RectangularSwitch";

interface CertificateControlsProps {
  courseName?: string;
  onClose?: () => void;
  languageToggled: boolean;
  setLanguageToggled: (languageToggled: boolean) => void;
  downloadCertificatePdf: (courseName?: string) => Promise<void>;
  isPreparingDownload: boolean;
}

const buttonClasses =
  "flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700";

const CertificateControls = ({
  courseName,
  onClose,
  languageToggled,
  setLanguageToggled,
  downloadCertificatePdf,
  isPreparingDownload,
}: CertificateControlsProps) => {
  const { t } = useTranslation();

  const handleDownload = () => {
    downloadCertificatePdf(courseName);
  };

  return (
    <div className="flex gap-3">
      <RectangularSwitch
        switchLabel="Language Toggle"
        onLabel="PL"
        offLabel="EN"
        toggled={languageToggled}
        setToggled={setLanguageToggled}
      />
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
      {onClose && (
        <button className={buttonClasses} onClick={onClose}>
          <X className="size-5" />
        </button>
      )}
    </div>
  );
};

export default CertificateControls;
