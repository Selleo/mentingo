import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useChangeCertificateBackground } from "~/api/mutations/admin/useChangeCertificateBackground";
import { useCourses } from "~/api/queries/useCourses";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "~/components/ui/use-toast";

const OrganizationSettings = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { t } = useTranslation();
  const changeCertificateBackgroundMutation = useChangeCertificateBackground();
  const { data: currentUser } = useCurrentUser();
  const { data } = useCourses();
  const courses = (data ?? []).filter((course) => course.authorId === currentUser?.id);
  const isUploading = changeCertificateBackgroundMutation.isPending;

  const handleFileSelect = (file: File) => {
    if (file.type === "image/png" || file.type === "image/svg+xml") {
      setSelectedFile(file);
    } else {
      alert(t("organizationSettingsView.other.fileExtension"));
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      console.error("No file selected.");
      return;
    }
    if (!courses || courses.length === 0) {
      console.error("No courses found.");
      return;
    }
    try {
      for (const course of courses) {
        await changeCertificateBackgroundMutation.mutateAsync({
          id: course.id,
          image: selectedFile,
        });
      }
      toast({
        variant: "default",
        description: t("organizationSettingsView.toast.uploadedSuccessfully"),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("organizationSettingsView.toast.failedToUpload"),
      });
      console.error("Error uploading certificate background:", error);
    }
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-2xl font-bold">{t("organizationSettingsView.header")}</h2>

      <Card>
        <CardHeader>
          <CardTitle></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-screen w-full">
            <label className="mb-4 block font-medium">
              {t("organizationSettingsView.subHeader")}
            </label>
            <ImageUploadInput
              field={{ value: selectedFile?.name }}
              handleImageUpload={handleFileSelect}
              isUploading={isUploading}
              imageUrl={selectedFile ? URL.createObjectURL(selectedFile) : undefined}
            />
            {selectedFile && (
              <button
                onClick={handleBulkUpload}
                disabled={isUploading || !courses || courses.length === 0}
                className="mt-4 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.other.uploadingImage")}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationSettings;
