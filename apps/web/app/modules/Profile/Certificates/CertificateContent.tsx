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
  hasBottomMargin?: boolean;
  backgroundImageUrl?: string | null;
}

const CertificateContent = ({
  studentName,
  courseName,
  completionDate,
  hasBottomMargin,
  backgroundImageUrl,
}: CertificateContentProps) => {
  return (
    <div
      style={{
        marginBottom: hasBottomMargin ? "6rem" : "0",
        maxHeight: "76vh",
        minWidth: "110vb",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "white",
        padding: "2rem 4rem",
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : "none",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <AppLogo style={{ height: "6rem", marginBottom: "2px" }} />
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
      <div style={{ marginBottom: "1rem" }}>
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
  );
};

export default CertificateContent;
