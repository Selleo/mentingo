const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

test("built declarations expose the template contracts consumed by the API", () => {
  const fileName = path.join(__dirname, "export-consumer.cts");
  const source = `
    import {
      EMAIL_TEMPLATE_STATUSES,
      getUsedEmailTemplateVariables,
      type EmailTemplateEvent,
      type EmailTemplateStatus,
      type LocalizedEmailTemplateContent,
      type PublishedEmailTemplate,
    } from "../dist/index.cjs";
    export type ConsumerContracts = [
      typeof EMAIL_TEMPLATE_STATUSES,
      typeof getUsedEmailTemplateVariables,
      EmailTemplateEvent,
      EmailTemplateStatus,
      LocalizedEmailTemplateContent,
      PublishedEmailTemplate,
    ];
  `;
  const options = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (requestedFileName, ...args) => {
    if (requestedFileName === fileName) {
      return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
    }
    return getSourceFile(requestedFileName, ...args);
  };
  const program = ts.createProgram([fileName], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    }),
  );

  const templates = require("../dist/index.cjs");
  assert.ok(templates.EMAIL_TEMPLATE_STATUSES);
  assert.equal(typeof templates.getUsedEmailTemplateVariables, "function");
});
