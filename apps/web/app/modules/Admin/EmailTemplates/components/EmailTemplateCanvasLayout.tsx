import styles from "./EmailTemplateCanvasLayout.module.css";

import type { ReactNode } from "react";

export function EmailTemplateCanvasLayout({
  primaryColor,
  children,
}: {
  primaryColor: string;
  children: ReactNode;
}) {
  // Equal nonzero side-cell heights divide the spanning card's height evenly.
  const sideCellStyle = { fontSize: "1px", lineHeight: "1px", padding: 0 };

  return (
    <div className={styles.container}>
      <table role="presentation" className="w-full border-collapse" cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            <td style={{ ...sideCellStyle, backgroundColor: primaryColor }}>&nbsp;</td>
            <td rowSpan={2} className={styles.card} style={{ padding: 0, verticalAlign: "top" }}>
              {children}
            </td>
            <td style={{ ...sideCellStyle, backgroundColor: primaryColor }}>&nbsp;</td>
          </tr>
          <tr>
            <td style={{ ...sideCellStyle, backgroundColor: "#fafafa" }}>&nbsp;</td>
            <td style={{ ...sideCellStyle, backgroundColor: "#fafafa" }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
