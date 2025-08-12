import {
  AppLogo,
  Award,
  // certificateText as CertificateText,
  hrLinePdf as HrLinePdf,
} from "~/assets/svgs";

interface CertificateContentProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  isModal?: boolean;
  backgroundImageUrl?: string | null;
  platformLogo?: string | null;
}

const CertificateContent = ({
  studentName,
  courseName,
  completionDate,
  isModal,
  backgroundImageUrl,
  platformLogo,
}: CertificateContentProps) => {
  return (
    <div
      style={{
        width: isModal ? "min(95vw, 1000px)" : "100%",
        display: "grid",
        placeItems: "center",
        margin: "0 auto",
        borderRadius: isModal ? "0" : "0.5rem",
        overflow: "hidden",
        backgroundColor: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "1rem",
            zIndex: 100,
          }}
        >
          {platformLogo ? (
            <img
              src={platformLogo}
              alt="Platform Logo"
              style={{ height: "6rem", marginBottom: "2px" }}
            />
          ) : (
            <AppLogo style={{ height: "6rem", marginBottom: "2px" }} />
          )}
          <h1
            style={{
              textAlign: "center",
              fontSize: "3.75rem",
              fontWeight: "bold",
              margin: "0 0 2px 0",
            }}
          >
            CERTIFICATE
          </h1>
          <p
            style={{
              fontSize: "1.25rem",
              fontWeight: "bold",
              margin: "0",
            }}
          >
            OF ACHIEVEMENT
          </p>
        </div>
        <div
          style={{
            position: "relative",
            margin: "2rem 0",
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              width: "75%",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#3b82f6",
              padding: "0.75rem 0",
              fontSize: "1.125rem",
              fontWeight: "600",
              letterSpacing: "0.05em",
              color: "white",
            }}
          >
            THIS CERTIFICATE IS PROUDLY PRESENTED TO
            <div
              style={{
                position: "absolute",
                left: "0",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <div
                style={{
                  height: "0",
                  width: "0",
                  borderBottom: "24px solid transparent",
                  borderLeft: "18px solid white",
                  borderTop: "24px solid transparent",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                right: "0",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <div
                style={{
                  height: "0",
                  width: "0",
                  borderBottom: "24px solid transparent",
                  borderRight: "18px solid white",
                  borderTop: "24px solid transparent",
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ marginBottom: "1rem", zIndex: 100 }}>
          <h2
            style={{
              textAlign: "center",
              fontSize: "1.875rem",
              fontWeight: "500",
              margin: "0 0 0.25rem 0",
            }}
          >
            {studentName}
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <p
              style={{
                textAlign: "center",
                fontSize: "1.125rem",
                color: "#6b7280",
                margin: "0",
              }}
            >
              Certificate for completion and great results in the course:
            </p>
          </div>
          <h3
            style={{
              textAlign: "center",
              fontSize: "1.25rem",
              fontWeight: "300",
              margin: "0",
            }}
          >
            &quot;{courseName}&quot;
          </h3>
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              marginRight: "4rem",
            }}
          >
            <p
              style={{
                paddingBottom: "0.5rem",
                fontSize: "1rem",
                color: "#6b7280",
                margin: "0",
              }}
            >
              {completionDate}
            </p>
            <HrLinePdf style={{ height: "0.25rem" }} />
            <p
              style={{
                paddingTop: "0.5rem",
                fontSize: "1rem",
                margin: "0",
              }}
            >
              DATE
            </p>
          </div>
          <Award style={{ width: "6rem", height: "6rem" }} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              marginLeft: "4rem",
            }}
          >
            <p
              style={{
                userSelect: "none",
                fontSize: "1rem",
                color: "transparent",
                margin: "0",
              }}
            >
              -
            </p>
            <HrLinePdf style={{ height: "0.25rem" }} />
            <p
              style={{
                paddingTop: "0.5rem",
                fontSize: "1rem",
                margin: "0",
              }}
            >
              SIGNATURE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateContent;
