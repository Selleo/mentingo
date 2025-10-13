import { Eye, Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { preview } from "vite";

const Options = () => {
  const { t } = useTranslation();

  const [preview, setPreview] = useState(false);

  const handlePreviewClick = () => {
    setPreview(!preview);
  };

  return (
    <div className="absolute right-5 top-5 z-10 w-60 rounded-md border bg-white shadow-xl">
      <ul className="py-1">
        <button onClick={() => handlePreviewClick}>
          <li className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100">
            <Eye className="size-6 text-primary-800" /> {t("studentCertificateView.button.preview")}
          </li>
        </button>
        <li className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100">
          <Download className="size-6 text-primary-800" />
          {t("studentCertificateView.button.download")}
        </li>
      </ul>
    </div>
  );
};
export { Options, preview };
