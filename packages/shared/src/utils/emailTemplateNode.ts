import type { EmailTemplateNode } from "../types/emailNotificationTemplate";

export const cloneEmailTemplateNode = (node: EmailTemplateNode): EmailTemplateNode => {
  const clone: EmailTemplateNode = { ...node };
  if (node.attrs) clone.attrs = { ...node.attrs };
  if (node.marks) clone.marks = node.marks.map((mark) => ({ ...mark }));
  if (node.content) clone.content = node.content.map(cloneEmailTemplateNode);
  return clone;
};
