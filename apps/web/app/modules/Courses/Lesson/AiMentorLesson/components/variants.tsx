import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

import type React from "react";

export const variants: Record<string, React.FC<React.HTMLAttributes<HTMLElement>>> = {
  h1: ({ ...props }) => (
    <h1 className="h1" {...props}>
      {props.children}
    </h1>
  ),
  h2: ({ ...props }) => (
    <h2 className="h2" {...props}>
      {props.children}
    </h2>
  ),
  h3: ({ ...props }) => (
    <h3 className="h3" {...props}>
      {props.children}
    </h3>
  ),
  h4: ({ ...props }) => (
    <h4 className="h4" {...props}>
      {props.children}
    </h4>
  ),
  h5: ({ ...props }) => (
    <h5 className="h5" {...props}>
      {props.children}
    </h5>
  ),
  h6: ({ ...props }) => (
    <h5 className="h6" {...props}>
      {props.children}
    </h5>
  ),
  code: ({ ...props }) => {
    const { children, className, ...rest } = props;
    const match = /language-(\w+)/.exec(className || "");

    return match ? (
      <div className="!overflow-x-scroll max-w-full">
        <SyntaxHighlighter {...rest} PreTag="div" language={match[1]} style={oneDark}>
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code
        className="bg-neutral-950 text-neutral-50 p-0.5 rounded-sm overflow-x-scroll"
        {...props}
      />
    );
  },
  table: ({ ...props }) => (
    <table
      className="min-w-full border border-gray-300 rounded-lg overflow-hidden bg-white shadow my-2"
      {...props}
    >
      {props.children}
    </table>
  ),
  thead: ({ ...props }) => <thead className="bg-gray-100">{props.children}</thead>,
  tbody: ({ ...props }) => <tbody className="divide-y divide-gray-200">{props.children}</tbody>,
  tr: ({ ...props }) => <tr className="hover:bg-gray-50 transition-colors">{props.children}</tr>,
  th: ({ ...props }) => (
    <th
      className="px-4 py-2 text-left font-semibold text-gray-700 border-b border-gray-300"
      {...props}
    >
      {props.children}
    </th>
  ),
  td: ({ ...props }) => (
    <td className="px-4 py-2 text-gray-600 border-b border-gray-200" {...props}>
      {props.children}
    </td>
  ),
  a: ({ ...props }) => (
    <a className="text-primary underline" {...props}>
      {props.children}
    </a>
  ),
  li: ({ ...props }) => (
    <li className="list-disc list-inside pl-4 text-gray-700" {...props}>
      {props.children}
    </li>
  ),
};
