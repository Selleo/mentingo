export type Attachment = {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  cid?: string;
};

export type Email = {
  to: string;
  from: string;
  subject: string;
  attachments?: Attachment[];
} & (
  | { html: string; text?: never }
  | { text: string; html?: never }
  | { text: string; html: string }
);
