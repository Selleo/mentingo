import { useNavigate } from "@remix-run/react";
import { ArrowBigLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

type ErrorBoundaryProps = {
  stack?: string;
  message?: string;
};

const CustomErrorBoundary = ({ stack, message }: ErrorBoundaryProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-100">
      <div className="container">
        <h1 className="mb-4 text-2xl font-bold text-primary-700">
          {t("common.error.somethingWentWrong")}
        </h1>
        {message && <p className="mb-4 text-gray-600">{message}</p>}
        {stack && <pre className="rounded-sm bg-slate-200 p-4 text-gray-600">{stack}</pre>}
      </div>
      <div className="flex justify-center gap-2">
        <Button
          onClick={() => navigate(-1)}
          className="mt-6 rounded bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-500"
        >
          <ArrowBigLeft />
          <span>{t("common.button.goBack")}</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate("/")}
          className="mt-6 rounded border border-primary bg-transparent px-4 py-2 text-primary transition-colors"
        >
          {t("common.button.goToDashboard")}
        </Button>
      </div>
    </div>
  );
};

export default CustomErrorBoundary;
