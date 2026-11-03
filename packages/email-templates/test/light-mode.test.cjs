const assert = require("node:assert/strict");
const { test } = require("node:test");
const { UserInviteEmail, renderEmailTemplate } = require("../dist/index.cjs");

const branding = { primaryColor: "#d5e5ff", companyName: "Premia społeczna" };

const emails = {
  invitation: () =>
    new UserInviteEmail({
      ...branding,
      language: "pl",
      invitedByUserName: "Maciej Hubert",
      createPasswordLink: "https://example.com/invitation",
    }),
  "custom template": () =>
    renderEmailTemplate({
      branding,
      subject: "Invitation",
      variables: {},
      document: {
        type: "doc",
        content: [
          {
            type: "text",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hello!" }] }],
          },
        ],
      },
    }),
};

for (const [name, createEmail] of Object.entries(emails)) {
  test(`${name} opts out of automatic dark mode in the rendered HTML`, () => {
    const { html, text } = createEmail();
    const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];

    assert.match(head, /<meta name="color-scheme" content="light"\s*\/>/);
    assert.match(head, /<meta name="supported-color-schemes" content="light"\s*\/>/);
    assert.match(head, /:root\s*\{[^}]*color-scheme:\s*only light\s*;/);
    assert.match(head, /:root\s*\{[^}]*supported-color-schemes:\s*light\s*;/);
    assert.match(html, /<html[^>]*style="[^"]*color-scheme:only light/);
    assert.match(head, /max-width: 555px/);
    assert.match(html, /background-color:#fafafa/);
    assert.match(html, /#d5e5ff/);
    assert.ok(text.trim());
    assert.doesNotMatch(text, /color-scheme/);
  });
}
