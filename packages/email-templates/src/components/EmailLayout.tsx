import { Body, Container, Font, Head, Html, Img, Section } from "@react-email/components";

import { getEmailCardBackground } from "@repo/shared";

import { getBaseEmailStyles } from "../utils";

import { Children, type ReactNode } from "react";

export type EmailLayoutProps = {
  primaryColor: string;
  headerContent: ReactNode;
  lowerContent: ReactNode;
  footerContent: ReactNode;
  borderCircleUrl?: string;
};

export const EmailLayout = ({
  primaryColor,
  headerContent,
  lowerContent,
  footerContent,
  borderCircleUrl,
}: EmailLayoutProps) => {
  const styles = getBaseEmailStyles(primaryColor);
  const sideCellStyle = { fontSize: "1px", lineHeight: "1px", padding: 0 };

  return (
    <Html>
      <Head>
        <style>{`@media only screen and (max-width: 555px) { .email-card-column { width: 90% !important; } }`}</style>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <Font
          fontFamily="all-round-gothic"
          fallbackFontFamily="Arial"
          fontWeight={600}
          webFont={{
            url: "https://use.typekit.net/af/964f70/00000000000000007735c47d/31/l?subset_id=2&fvd=n6&v=3",
            format: "woff2",
          }}
        />
        <Font
          fontFamily="Open Sans"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap",
            format: "woff2",
          }}
        />
      </Head>
      <Body
        style={{ ...styles.body, fontFamily: '"Open Sans", Arial, sans-serif', color: "#222222" }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          style={{
            backgroundColor: "#fafafa",
            borderCollapse: "collapse",
            borderSpacing: 0,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col />
            <col className="email-card-column" style={{ width: "500px" }} />
            <col />
          </colgroup>
          <tbody style={{ backgroundColor: primaryColor }}>
            <tr style={{ backgroundColor: primaryColor }}>
              <td
                colSpan={3}
                height="50"
                style={{ ...sideCellStyle, backgroundColor: primaryColor }}
              >
                &nbsp;
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <td height="1" style={{ ...sideCellStyle, backgroundColor: primaryColor }}>
                &nbsp;
              </td>
              <td
                rowSpan={2}
                width="500"
                className="email-card-column"
                style={{
                  width: "500px",
                  padding: 0,
                  verticalAlign: "top",
                  backgroundColor: "#fafafa",
                  backgroundImage: getEmailCardBackground(primaryColor),
                }}
              >
                <Container
                  style={{
                    ...styles.headerContainer,
                    width: "100%",
                    borderRadius: "1.5rem",
                  }}
                >
                  {headerContent}
                  {lowerContent}
                  {borderCircleUrl ? (
                    <Img
                      src={borderCircleUrl}
                      height="50"
                      width="auto"
                      alt=""
                      style={{ display: "block", borderBottomLeftRadius: "1.5rem" }}
                    />
                  ) : (
                    <Section style={{ height: "50px" }} />
                  )}
                </Container>
              </td>
              <td height="1" style={{ ...sideCellStyle, backgroundColor: primaryColor }}>
                &nbsp;
              </td>
            </tr>
            <tr>
              <td height="1" style={{ ...sideCellStyle, backgroundColor: "#fafafa" }}>
                &nbsp;
              </td>
              <td height="1" style={{ ...sideCellStyle, backgroundColor: "#fafafa" }}>
                &nbsp;
              </td>
            </tr>
          </tbody>
        </table>
        {Children.toArray(footerContent).length > 0 ? (
          <Section style={styles.footerSection}>{footerContent}</Section>
        ) : (
          <Section
            style={{
              height: "50px",
              backgroundColor: "#ffffff",
              fontSize: "1px",
              lineHeight: "1px",
            }}
            aria-hidden="true"
          >
            &nbsp;
          </Section>
        )}
      </Body>
    </Html>
  );
};
