import { Button, Img, Section, Text } from "@react-email/components";

import { getBaseEmailStyles } from "../utils";
import { EmailLayout } from "../components/EmailLayout";

import type { BaseEmailSettings } from "../types";

export type BaseEmailTemplateProps = {
  heading: string;
  paragraphs: string[];
  buttonText: string;
  buttonLink: string;
} & BaseEmailSettings;

export const BaseEmailTemplate = ({
  heading,
  paragraphs,
  buttonText,
  buttonLink,
  primaryColor,
  companyName,
}: BaseEmailTemplateProps) => {
  const styles = getBaseEmailStyles(primaryColor);
  return (
    <EmailLayout
      primaryColor={primaryColor}
      borderCircleUrl="cid:border-circle"
      headerContent={
        <>
          <Section style={styles.logoSection} className="logo-section">
            <Img src="cid:logo" width="auto" height="32" alt="platform logo" />
          </Section>
          <Section style={styles.contentSection}>
            <Text style={styles.heading} className="heading">
              {heading}
            </Text>
          </Section>
        </>
      }
      lowerContent={
        <Section style={styles.contentSection}>
          {paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph} className="paragraph">
              {paragraph}
            </Text>
          ))}
          <Section style={styles.buttonWrapper} className="button-wrapper">
            <Button style={styles.button} href={buttonLink} className="button">
              <Text style={styles.buttonText} className="button-text">
                {buttonText}
              </Text>
            </Button>
          </Section>
        </Section>
      }
      footerContent={
        <Text style={styles.footerText} className="footer-text">
          Powered by {companyName}
        </Text>
      }
    />
  );
};

export default BaseEmailTemplate;
