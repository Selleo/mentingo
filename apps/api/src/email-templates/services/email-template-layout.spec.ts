import { EMAIL_TEMPLATE_DEFINITIONS, renderEmailTemplate } from "@repo/email-templates";

describe("Email template branded layout", () => {
  it.each([undefined, 8])("renders divider height %s", (height) => {
    const rendered = renderEmailTemplate({
      document: {
        type: "doc",
        version: 1,
        content: [{ type: "divider", ...(height === undefined ? {} : { attrs: { height } }) }],
      },
      subject: "Divider",
      variables: {},
      branding: { companyName: "Tenant", primaryColor: "#4796fd" },
    });
    expect(rendered.html).toContain(`border-top-width:${height ?? 1}px`);
  });

  it.each(["https://example.com/image.png", "cid:uploaded-image"])(
    "centers sent image blocks from %s",
    (src) => {
      const rendered = renderEmailTemplate({
        document: {
          type: "doc",
          version: 1,
          content: [{ type: "image", attrs: { src, alt: "Centered image", width: 180 } }],
        },
        subject: "Image",
        variables: {},
        branding: { companyName: "Tenant", primaryColor: "#4796fd" },
      });
      expect(rendered.html).toMatch(/<td[^>]*align="center"[^>]*>\s*<img[^>]*alt="Centered image"/);
      expect(rendered.html).toContain('width="180"');
      expect(rendered.html).toContain("margin:0 auto");
      expect(rendered.html).toContain("max-width:100%");
    },
  );

  it.each(EMAIL_TEMPLATE_DEFINITIONS)("preserves the branded shell for $event", (definition) => {
    const rendered = renderEmailTemplate({
      document: definition.defaultDocuments.en,
      subject: definition.subjects.en,
      variables: Object.fromEntries(
        definition.variables.map((variable) => [variable.key, variable.sampleValue]),
      ),
      branding: {
        companyName: "Tenant company",
        primaryColor: "#5345ad",
        logoUrl: "cid:logo",
        borderCircleUrl: "cid:border-circle",
      },
    });
    expect(rendered.html).toContain("background-color:#5345ad");
    expect(rendered.html).not.toContain("linear-gradient");
    expect(rendered.html).toContain('rowspan="2"');
    expect(rendered.html).toContain("background-color:#ffffff");
    expect(rendered.html).toContain("border-radius:1.5rem 1.5rem 0 0");
    expect(rendered.html).toContain("border-radius:0 0 1.5rem 1.5rem");
    expect(rendered.html).toContain("Open Sans");
    expect(rendered.html).toContain('src="cid:logo"');
    expect(rendered.html).toContain('src="cid:border-circle"');
    expect(rendered.html).toContain("color:#ffffff");
    expect(rendered.text).toContain("Tenant company");
  });
});
