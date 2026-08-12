import { renderToStaticMarkup } from "react-dom/server";

import { EmailContent } from "./email-content";

import type { ReactElement } from "react";

export function emailTemplateFactory<T extends unknown[]>(
  template: (...args: T) => ReactElement,
): new (...args: T) => EmailContent {
  return class implements EmailContent {
    private readonly args: T;

    constructor(...args: T) {
      this.args = args;
    }

    get props(): T {
      return this.args;
    }

    get text(): string {
      return toPlainText(this.renderDocument());
    }

    get html(): string {
      return this.renderDocument();
    }

    private renderDocument(): string {
      const html = renderToStaticMarkup(template(...this.props));
      return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${html.replace(/<!DOCTYPE.*?>/, "")}`;
    }
  };
}

const toPlainText = (html: string): string =>
  decodeHtmlEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 $1")
      .replace(/<\/(p|div|section|tr|table|h[1-6]|li)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim(),
  );

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
