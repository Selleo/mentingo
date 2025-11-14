import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Html,
  Img,
  Section,
  Text,
} from "@react-email/components";

import { DefaultEmailSettings } from "types";

import { getBaseEmailStyles } from "../utils";

export type BaseEmailTemplateProps = {
  heading: string;
  paragraphs: string[];
  buttonText: string;
  buttonLink: string;
} & DefaultEmailSettings;

export const BaseEmailTemplate = ({
  heading,
  paragraphs,
  buttonText,
  buttonLink,
  primaryColor = "#4796FD",
}: BaseEmailTemplateProps) => {
  const styles = getBaseEmailStyles(primaryColor);

  return (
    <Html>
      <Head>
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
      <Body style={styles.body}>
        <Section style={styles.headerSection} className="header-section">
          <Container style={styles.headerContainer} className="header-container">
            <Section style={styles.simpleLogoSection} className="simple-logo-section">
              <Img
                src="cid:simple-logo"
                width="auto"
                height="50"
                alt="platform icon"
                style={styles.simpleLogoImage}
              />
            </Section>
            <Section style={styles.logoSection} className="logo-section">
              <Img src="cid:logo" width="auto" height="32" alt="platform logo" />
            </Section>
            <Section style={styles.contentSection}>
              <Text style={styles.heading} className="heading">
                {heading}
              </Text>
              {paragraphs.map((paragraph, index) => (
                <Text key={index} style={styles.paragraph} className="paragraph">
                  {paragraph}
                </Text>
              ))}
            </Section>
          </Container>
        </Section>
        <Section style={styles.buttonSection} className="button-section">
          <Container style={styles.buttonContainer} className="button-container">
            <Section style={styles.contentSection}>
              <Section style={styles.buttonWrapper} className="button-wrapper">
                <Button style={styles.button} href={buttonLink} className="button">
                  <Text style={styles.buttonText} className="button-text">
                    {buttonText}
                  </Text>
                </Button>
              </Section>
            </Section>

            <Img
              style={{
                display: "block",
              }}
              src="cid:border-circle"
              height="50"
              width="auto"
              alt="border circle"
            />
          </Container>
        </Section>
        <Section style={styles.footerSection}>
          <Text style={styles.footerText} className="footer-text">
            Powered by &copy;{new Date().getFullYear()} Mentingo.com
          </Text>
        </Section>
      </Body>
    </Html>
  );
};

export default BaseEmailTemplate;
