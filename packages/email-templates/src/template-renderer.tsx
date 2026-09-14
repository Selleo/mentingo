import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Section,
  Text,
  render,
} from "@react-email/components";
import React from "react";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { formatEmailTemplateVariables } from "./utils/formatEmailTemplateVariables";

import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_INLINE_MARK_TYPES,
  type EmailTemplateDocument,
  type EmailTemplateInlineNode,
  type EmailTemplateVariableValue,
} from "./template-registry.types";
import { getBaseEmailStyles } from "./utils";

export type EmailTemplateBranding = {
  companyName: string;
  primaryColor: string;
  logoUrl?: string;
};

export type RenderEmailTemplateInput = {
  document: EmailTemplateDocument;
  subject: string;
  variables: Readonly<Record<string, EmailTemplateVariableValue>>;
  branding: EmailTemplateBranding;
  language?: SupportedLanguages;
};

export type RenderedEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const replaceVariables = (
  value: string,
  variables: Readonly<Record<string, EmailTemplateVariableValue>>,
) =>
  value.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    const replacement = variables[key];
    return Array.isArray(replacement) ? JSON.stringify(replacement) : String(replacement ?? "");
  });

const renderInlineNodes = (
  nodes: readonly EmailTemplateInlineNode[],
  variables: Readonly<Record<string, EmailTemplateVariableValue>>,
) =>
  nodes.map((node, nodeIndex) => {
    let content: React.ReactNode = replaceVariables(node.text, variables);

    for (const [markIndex, mark] of (node.marks ?? []).entries()) {
      const key = `${nodeIndex}-${markIndex}`;

      if (mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.BOLD) {
        content = <strong key={key}>{content}</strong>;
      }

      if (mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.ITALIC) {
        content = <em key={key}>{content}</em>;
      }

      if (mark.type === EMAIL_TEMPLATE_INLINE_MARK_TYPES.LINK) {
        content = (
          <a key={key} href={replaceVariables(mark.attrs.href, variables)}>
            {content}
          </a>
        );
      }
    }

    return <React.Fragment key={nodeIndex}>{content}</React.Fragment>;
  });

const EmailTemplateDocumentComponent = ({
  document,
  variables,
  branding,
}: Omit<RenderEmailTemplateInput, "subject">) => {
  const styles = getBaseEmailStyles(branding.primaryColor);

  return (
    <Html>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
      </Head>
      <Body style={styles.body}>
        <Container>
          {document.content.map((block, blockIndex) => {
            switch (block.type) {
              case EMAIL_TEMPLATE_BLOCK_TYPES.HEADER:
                return (
                  <Section key={blockIndex} style={styles.logoSection}>
                    {branding.logoUrl ? (
                      <Img
                        src={branding.logoUrl}
                        width="auto"
                        height="32"
                        alt={`${branding.companyName} logo`}
                      />
                    ) : (
                      <Text>{branding.companyName}</Text>
                    )}
                  </Section>
                );
              case EMAIL_TEMPLATE_BLOCK_TYPES.HEADING:
                return block.content.map((paragraph, paragraphIndex) => (
                  <Text key={`${blockIndex}-${paragraphIndex}`} style={styles.heading}>
                    {renderInlineNodes(paragraph.content ?? [], variables)}
                  </Text>
                ));
              case EMAIL_TEMPLATE_BLOCK_TYPES.TEXT:
                return block.content.map((paragraph, paragraphIndex) => (
                  <Text
                    key={`${blockIndex}-${paragraphIndex}`}
                    style={{ ...styles.paragraph, whiteSpace: "pre-wrap" }}
                  >
                    {renderInlineNodes(paragraph.content ?? [], variables)}
                  </Text>
                ));
              case EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON:
                return (
                  <Section key={blockIndex} style={styles.buttonWrapper}>
                    <Button
                      style={styles.button}
                      href={replaceVariables(block.attrs.url, variables)}
                    >
                      {replaceVariables(block.attrs.label, variables)}
                    </Button>
                  </Section>
                );
              case EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE:
                return (
                  <Img
                    key={blockIndex}
                    src={replaceVariables(block.attrs.src, variables)}
                    alt={replaceVariables(block.attrs.alt, variables)}
                    width={block.attrs.width}
                  />
                );
              case EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER:
                return <Hr key={blockIndex} />;
              case EMAIL_TEMPLATE_BLOCK_TYPES.SPACER:
                return <Section key={blockIndex} style={{ height: block.attrs.height }} />;
              case EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER:
                return (
                  <Text key={blockIndex} style={styles.footerText}>
                    {block.content
                      ? block.content.map((paragraph, index) => (
                          <React.Fragment key={index}>
                            {index > 0 && <br />}
                            {renderInlineNodes(paragraph.content ?? [], variables)}
                          </React.Fragment>
                        ))
                      : replaceVariables(block.attrs.text, variables)}
                  </Text>
                );
            }
          })}
        </Container>
      </Body>
    </Html>
  );
};

export const renderEmailTemplate = ({
  document,
  subject,
  variables,
  branding,
  language = SUPPORTED_LANGUAGES.EN,
}: RenderEmailTemplateInput): RenderedEmailTemplate => {
  const resolvedVariables = {
    ...formatEmailTemplateVariables(variables, language),
    company_name: branding.companyName,
  };

  const email = (
    <EmailTemplateDocumentComponent
      document={document}
      variables={resolvedVariables}
      branding={branding}
    />
  );

  return {
    subject: replaceVariables(subject, resolvedVariables),
    html: render(email),
    text: render(email, { plainText: true }),
  };
};
