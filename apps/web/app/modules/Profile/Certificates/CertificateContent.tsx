import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";

interface CertificateContentProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  isModal?: boolean;
  isDownload?: boolean;
  backgroundImageUrl?: string | null;
  platformLogo?: string | null;
  lang?: "pl" | "en";
}

const translations = {
  pl: {
    certificate: "CERTYFIKAT",
    courseCompletion: "UKOŃCZENIA KURSU",
    certifyThat: "NINIEJSZYM ZAŚWIADCZA SIĘ, ŻE",
    successfulCompletion: "ukończył/a kurs",
    confirmation: "potwierdzając tym samym realizację programu szkoleniowego.",
    date: "Data",
    signature: "Podpis",
  },
  en: {
    certificate: "CERTIFICATE",
    courseCompletion: "OF COURSE COMPLETION",
    certifyThat: "THIS IS TO CERTIFY THAT",
    successfulCompletion: "has successfully completed the course",
    confirmation: "thereby confirming participation in the full training program.",
    date: "Date",
    signature: "Signature",
  },
};

const CertificateContent = ({
  studentName,
  courseName,
  completionDate,
  isModal,
  isDownload,
  backgroundImageUrl,
  platformLogo,
  lang = "en",
}: CertificateContentProps) => {
  return (
    <div
      className={cn(
        "mx-auto flex aspect-[297/210] flex-col items-center justify-center gap-y-4 overflow-hidden p-10 xl:gap-y-12",
        isModal ? "h-auto w-[min(95vw,1000px)]" : "h-auto w-full",
        !isDownload && "bg-white",
        !isModal && "rounded-lg",
      )}
      style={{
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {platformLogo ? (
        <img
          src={platformLogo}
          alt="Platform Logo"
          className={cn("aspect-auto h-8", !isModal && "scale-75 xl:scale-100")}
        />
      ) : (
        <Icon name="AppLogo" className={cn("h-8", !isModal && "scale-75 xl:scale-100")} />
      )}
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-y-4",
          !isModal && "scale-75 xl:scale-100",
        )}
      >
        <p className="text-5xl font-black uppercase tracking-wider text-gray-800">
          {translations[lang].certificate}
        </p>
        <p className="text-xl font-semibold uppercase text-gray-600">
          {translations[lang].courseCompletion}
        </p>
        <div className="relative flex items-center justify-center">
          <Icon name="Ribbon" className="h-12 text-[#5d84d4]" />
          <p className="text-md absolute inset-0 flex items-center justify-center font-semibold uppercase text-white">
            {translations[lang].certifyThat}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "flex flex-col items-center justify-center",
          !isModal && "scale-75 xl:scale-100",
        )}
      >
        <p className="mb-4 text-3xl tracking-wider text-gray-800">{studentName}</p>
        <p className="text-md text-gray-600">{translations[lang].successfulCompletion}</p>
        <p className="text-lg text-gray-800">&quot;{courseName}&quot;</p>
        <p className="text-md text-gray-600">{translations[lang].confirmation}</p>
      </div>

      <div className={cn("flex items-end gap-x-40", !isModal && "scale-75 xl:scale-100")}>
        <div className="flex w-[200px] flex-col items-center">
          <p className="text-md text-gray-600">{completionDate}</p>
          <hr className="mx-auto mb-3 w-full" />
          <p className="text-md uppercase text-gray-800">{translations[lang].date}</p>
        </div>
        <div className="flex w-[200px] flex-col items-center">
          <hr className="mx-auto mb-3 w-full" />
          <p className="text-md uppercase text-gray-800">{translations[lang].signature}</p>
        </div>
      </div>
    </div>
  );
};

export default CertificateContent;
