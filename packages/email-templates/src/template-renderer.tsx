import { Button, Column, Hr, Img, Row, Section, Text, render } from "@react-email/components";
import React from "react";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { formatEmailTemplateVariables } from "./utils/formatEmailTemplateVariables";
import { resolveInlineVariables } from "./utils/resolveInlineVariables";

import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  EMAIL_TEMPLATE_INLINE_MARK_TYPES,
  type EmailTemplateInlineNode,
  type EmailTemplateVariableValue,
} from "./template-registry.types";
import { getBaseEmailStyles } from "./utils";
import { EmailLayout } from "./components/EmailLayout";

import type { RenderEmailTemplateInput, RenderedEmailTemplate } from "./template-renderer.types";

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
  resolveInlineVariables(nodes, (text) => replaceVariables(text, variables)).map(
    (node, nodeIndex) => {
      let content: React.ReactNode = node.text;

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
    },
  );

const EmailTemplateDocumentComponent = ({
  document,
  variables,
  branding,
}: Omit<RenderEmailTemplateInput, "subject">) => {
  const styles = getBaseEmailStyles(branding.primaryColor);

  const renderedBlocks = document.content.map((block, blockIndex) => {
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
              style={{ ...styles.button, ...styles.buttonText }}
              href={replaceVariables(block.attrs.url, variables)}
            >
              <Text style={styles.buttonText}>
                {replaceVariables(block.attrs.label, variables)}
              </Text>
            </Button>
          </Section>
        );
      case EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE:
        return (
          <Section key={blockIndex}>
            <Row>
              <Column align="center">
                <Img
                  src={replaceVariables(block.attrs.src, variables)}
                  alt={replaceVariables(block.attrs.alt, variables)}
                  width={block.attrs.width}
                  style={{ margin: "0 auto", maxWidth: "100%", height: "auto" }}
                />
              </Column>
            </Row>
          </Section>
        );
      case EMAIL_TEMPLATE_BLOCK_TYPES.DIVIDER:
        return <Hr key={blockIndex} style={{ borderTopWidth: block.attrs?.height ?? 1 }} />;
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
  });

  // Only trailing footers belong outside the card; preserve the order of all other blocks.
  let footerStart = document.content.length;
  while (
    footerStart > 0 &&
    document.content[footerStart - 1]?.type === EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER
  ) {
    footerStart -= 1;
  }
  let lowerContentStart = 0;

  while (
    lowerContentStart < footerStart &&
    (document.content[lowerContentStart]?.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADER ||
      document.content[lowerContentStart]?.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADING)
  ) {
    lowerContentStart += 1;
  }

  const cardBlocks = renderedBlocks.slice(0, footerStart).map((content, index) => (
    <Section
      key={index}
      style={
        document.content[index]?.type === EMAIL_TEMPLATE_BLOCK_TYPES.HEADER
          ? undefined
          : styles.contentSection
      }
    >
      {content}
    </Section>
  ));

  return (
    <EmailLayout
      primaryColor={branding.primaryColor}
      borderCircleUrl={branding.borderCircleUrl}
      headerContent={cardBlocks.slice(0, lowerContentStart)}
      lowerContent={cardBlocks.slice(lowerContentStart)}
      footerContent={renderedBlocks.slice(footerStart)}
    />
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
