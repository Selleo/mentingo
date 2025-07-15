import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const OrganizationSettings = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { t } = useTranslation();

  const handleFileSelect = (file: File) => {
    if (file.type === "image/png" || file.type === "image/svg+xml") {
      setSelectedFile(file);
    } else {
      alert(t("organizationSettingsView.other.fileExtension"));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDivClick = () => {
    document.getElementById("file-upload")?.click();
  };

  // TODO implement file upload logic when aws s3 resource is ready

  // const handleUpload = () => {
  //   if (selectedFile) {
  //   }
  // };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-2xl font-bold">{t("organizationSettingsView.header")}</h2>

      <Card>
        <CardHeader>
          <CardTitle>{t("")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <label className="mb-4 block text-sm font-medium">
              {t("organizationSettingsView.subHeader")}
            </label>

            <div
              className={`size-full cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleDivClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleDivClick();
                }
              }}
            >
              <input
                type="file"
                accept=".png,.svg"
                onChange={handleInputChange}
                className="hidden"
                id="file-upload"
              />

              <div className="space-y-2">
                <div className="text-gray-500">
                  {selectedFile ? (
                    <p>
                      {t("organizationSettingsView.other.selected")} {selectedFile.name}
                    </p>
                  ) : (
                    <>
                      <p>{t("adminScorm.other.uploadFileHeader")}</p>
                      <p className="text-xs">{t("organizationSettingsView.other.fileExtension")}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {selectedFile && (
              <button
                // onClick={handleUpload}
                className="mt-4 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                {t("uploadFile.header")}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationSettings;
