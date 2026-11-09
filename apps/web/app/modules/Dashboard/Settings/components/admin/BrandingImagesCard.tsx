import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

import type { ReactNode } from "react";

export const BrandingImagesCard = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="h5">{t("brandingImages.title")}</CardTitle>
        <CardDescription className="body-lg-md">{t("brandingImages.description")}</CardDescription>
      </CardHeader>
      <CardContent className="mt-4 grid gap-6 md:grid-cols-2 2xl:grid-cols-4">
        {children}
      </CardContent>
    </Card>
  );
};
