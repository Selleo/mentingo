import path from "path";
import fs from "fs";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";

const traverse = _traverse.default;
const generate = _generate.default;

const generateIndexContent = () => {
  const templatesDir = path.resolve(process.cwd(), "src", "templates");

  const templateFiles = fs
    .readdirSync(templatesDir)
    .filter((file) => file.endsWith(".tsx") && file !== "index.ts");

  const ast = parser.parse("", {
    sourceType: "module",
    plugins: ["typescript"],
  });

  traverse(ast, {
    Program(path) {
      const factoryImport = t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier("emailTemplateFactory"),
            t.identifier("emailTemplateFactory"),
          ),
        ],
        t.stringLiteral("./email-factory"),
      );
      path.pushContainer("body", factoryImport);

      templateFiles.forEach((templateFile) => {
        const templateName = templateFile.replace(".tsx", "");
        const variableName = templateName.charAt(0).toUpperCase() + templateName.slice(1);

        const importDeclaration = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(`${variableName}Template`))],
          t.stringLiteral(`./templates/${templateName}`),
        );

        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration("const", [
            t.variableDeclarator(
              t.identifier(variableName),
              t.callExpression(t.identifier("emailTemplateFactory"), [
                t.identifier(`${variableName}Template`),
              ]),
            ),
          ]),
        );

        path.pushContainer("body", importDeclaration);
        path.pushContainer("body", exportDeclaration);
      });

      path.pushContainer(
        "body",
        t.exportNamedDeclaration(
          null,
          [
            t.exportSpecifier(
              t.identifier("getCourseDueDateReminderEmailTranslations"),
              t.identifier("getCourseDueDateReminderEmailTranslations"),
            ),
          ],
          t.stringLiteral("./translations/courseDueDateReminder"),
        ),
      );

      path.pushContainer(
        "body",
        t.exportNamedDeclaration(
          null,
          [
            t.exportSpecifier(
              t.identifier("EMAIL_SUBJECTS_TRANSLATIONS"),
              t.identifier("EMAIL_SUBJECTS_TRANSLATIONS"),
            ),
            t.exportSpecifier(t.identifier("getEmailSubject"), t.identifier("getEmailSubject")),
          ],
          t.stringLiteral("./email-subjects"),
        ),
      );

      path.pushContainer(
        "body",
        t.exportNamedDeclaration(
          null,
          [
            t.exportSpecifier(
              t.identifier("EMAIL_TEMPLATE_DEFINITIONS"),
              t.identifier("EMAIL_TEMPLATE_DEFINITIONS"),
            ),
            t.exportSpecifier(
              t.identifier("EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT"),
              t.identifier("EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT"),
            ),
            t.exportSpecifier(
              t.identifier("getEmailTemplateDefinition"),
              t.identifier("getEmailTemplateDefinition"),
            ),
            t.exportSpecifier(
              t.identifier("EMAIL_TEMPLATE_SYSTEM_VARIABLES"),
              t.identifier("EMAIL_TEMPLATE_SYSTEM_VARIABLES"),
            ),
          ],
          t.stringLiteral("./template-registry"),
        ),
      );

      path.pushContainer(
        "body",
        t.exportAllDeclaration(t.stringLiteral("./template-registry.types")),
      );

      path.pushContainer("body", t.exportAllDeclaration(t.stringLiteral("./template-renderer")));
      path.pushContainer(
        "body",
        t.exportAllDeclaration(t.stringLiteral("./template-renderer.types")),
      );
      path.pushContainer("body", t.exportAllDeclaration(t.stringLiteral("./publication.types")));
      path.pushContainer("body", t.exportAllDeclaration(t.stringLiteral("./publications")));
      path.pushContainer("body", t.exportAllDeclaration(t.stringLiteral("./template-usage")));
    },
  });

  const output = generate(
    ast,
    {
      retainLines: false,
      concise: false,
      decoratorsBeforeExport: true,
      jsescOption: {
        minimal: true,
      },
    },
    ast.program,
  );

  return output.code;
};

/** Generate the complete entry before tsup starts parallel JS and declaration builds. */
export const generateEmailTemplateIndex = () => {
  const indexFilePath = path.resolve(process.cwd(), "src", "index.ts");
  const content = generateIndexContent();
  if (fs.existsSync(indexFilePath) && fs.readFileSync(indexFilePath, "utf-8") === content) return;

  // Readers must never observe the empty file produced by truncating a live entry.
  const temporaryPath = `${indexFilePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content, "utf-8");
    fs.renameSync(temporaryPath, indexFilePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
  console.log(`Generated ${indexFilePath}.`);
};
