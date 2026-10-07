import { createInstance } from "i18next";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import en from "~/locales/en/translation.json";
import pl from "~/locales/pl/translation.json";
import CreatePhishingPage from "~/modules/Phishing/CreatePhishing.page";
import PhishingPage from "~/modules/Phishing/Phishing.page";
import PhishingHallPage from "~/modules/Phishing/PhishingHall.page";
import PhishingReportPage from "~/modules/Phishing/PhishingReport.page";
import "~/index.css";

const i18n = createInstance();
await i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pl: { translation: pl } },
  lng: new URLSearchParams(location.search).get("lang") ?? "pl",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
createRoot(document.getElementById("root")!).render(
  <>
    <div className="border-b bg-warning-50 px-6 py-3 text-sm" role="note">
      ISOLATED UI PREVIEW · FIXTURE DATA · no API requests or email delivery
    </div>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/phishing" element={<PhishingPage />} />
        <Route path="/phishing/new" element={<CreatePhishingPage />} />
        <Route path="/phishing/:id" element={<PhishingReportPage />} />
        <Route path="/phishing/:id/hall-of-shame" element={<PhishingHallPage />} />
        <Route path="*" element={<PhishingPage />} />
      </Routes>
    </BrowserRouter>
  </>,
);
