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
            t.identifier("emailTemplateFactory")
          ),
        ],
        t.stringLiteral("./email-factory")
      );
      path.pushContainer("body", factoryImport);

      templateFiles.forEach((templateFile) => {
        const templateName = templateFile.replace(".tsx", "");
        const variableName =
          templateName.charAt(0).toUpperCase() + templateName.slice(1);

        const importDeclaration = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(`${variableName}Template`))],
          t.stringLiteral(`./templates/${templateName}`)
        );

        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration("const", [
            t.variableDeclarator(
              t.identifier(variableName),
              t.callExpression(t.identifier("emailTemplateFactory"), [
                t.identifier(`${variableName}Template`),
              ])
            ),
          ])
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
              t.identifier("getCourseDueDateReminderEmailTranslations")
            ),
          ],
          t.stringLiteral("./translations/courseDueDateReminder")
        )
      );
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
    ast.program
  );

  return output.code;
};

const tsupPlugin = () => {
  return {
    name: "dynamic-template-exports",
    buildEnd: () => {
      const indexFilePath = path.resolve(process.cwd(), "src", "index.ts");
      const content = generateIndexContent();

      fs.writeFileSync(indexFilePath, content, "utf-8");
      console.log(`Generated ${indexFilePath}.`);

      const savedContent = fs.readFileSync(indexFilePath, "utf-8");

      if (content !== savedContent) {
        console.error("Error: Saved content does not match generated content!");
      }
    },
  };
};

export default tsupPlugin;
