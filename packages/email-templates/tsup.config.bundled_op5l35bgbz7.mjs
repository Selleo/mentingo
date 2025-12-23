// tsup.config.ts
import { defineConfig } from "tsup";

// plugin.mjs
import path from "path";
import fs from "fs";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
var traverse = _traverse.default;
var generate = _generate.default;
var generateIndexContent = () => {
  const templatesDir = path.resolve(process.cwd(), "src", "templates");
  const templateFiles = fs.readdirSync(templatesDir).filter((file) => file.endsWith(".tsx") && file !== "index.ts");
  const ast = parser.parse("", {
    sourceType: "module",
    plugins: ["typescript"]
  });
  traverse(ast, {
    Program(path2) {
      const factoryImport = t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier("emailTemplateFactory"),
            t.identifier("emailTemplateFactory")
          )
        ],
        t.stringLiteral("./email-factory")
      );
      path2.pushContainer("body", factoryImport);
      templateFiles.forEach((templateFile) => {
        const templateName = templateFile.replace(".tsx", "");
        const variableName = templateName.charAt(0).toUpperCase() + templateName.slice(1);
        const importDeclaration2 = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(`${variableName}Template`))],
          t.stringLiteral(`./templates/${templateName}`)
        );
        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration("const", [
            t.variableDeclarator(
              t.identifier(variableName),
              t.callExpression(t.identifier("emailTemplateFactory"), [
                t.identifier(`${variableName}Template`)
              ])
            )
          ])
        );
        path2.pushContainer("body", importDeclaration2);
        path2.pushContainer("body", exportDeclaration);
      });
    }
  });
  const output = generate(
    ast,
    {
      retainLines: false,
      concise: false,
      decoratorsBeforeExport: true,
      jsescOption: {
        minimal: true
      }
    },
    ast.program
  );
  return output.code;
};
var tsupPlugin = () => {
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
    }
  };
};
var plugin_default = tsupPlugin;

// tsup.config.ts
var tsup_config_default = defineConfig(async (options) => {
  return {
    entry: ["./src/index.ts"],
    format: ["cjs", "esm"],
    plugins: [plugin_default()],
    clean: true,
    dts: true,
    ...options
  };
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiLCAicGx1Z2luLm1qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvamhlcm1hL1dlYnN0b3JtUHJvamVjdHMvbWVudGluZ28vcGFja2FnZXMvZW1haWwtdGVtcGxhdGVzL3RzdXAuY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9qaGVybWEvV2Vic3Rvcm1Qcm9qZWN0cy9tZW50aW5nby9wYWNrYWdlcy9lbWFpbC10ZW1wbGF0ZXNcIjtjb25zdCBfX2luamVjdGVkX2ltcG9ydF9tZXRhX3VybF9fID0gXCJmaWxlOi8vL1VzZXJzL2poZXJtYS9XZWJzdG9ybVByb2plY3RzL21lbnRpbmdvL3BhY2thZ2VzL2VtYWlsLXRlbXBsYXRlcy90c3VwLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgdHlwZSBPcHRpb25zIH0gZnJvbSBcInRzdXBcIjtcbmltcG9ydCB0c3VwUGx1Z2luIGZyb20gXCIuL3BsdWdpbi5tanNcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKGFzeW5jIChvcHRpb25zOiBPcHRpb25zKSA9PiB7XG4gIHJldHVybiB7XG4gICAgZW50cnk6IFtcIi4vc3JjL2luZGV4LnRzXCJdLFxuICAgIGZvcm1hdDogW1wiY2pzXCIsIFwiZXNtXCJdLFxuICAgIHBsdWdpbnM6IFt0c3VwUGx1Z2luKCldLFxuICAgIGNsZWFuOiB0cnVlLFxuICAgIGR0czogdHJ1ZSxcbiAgICAuLi5vcHRpb25zLFxuICB9O1xufSk7XG4iLCAiY29uc3QgX19pbmplY3RlZF9maWxlbmFtZV9fID0gXCIvVXNlcnMvamhlcm1hL1dlYnN0b3JtUHJvamVjdHMvbWVudGluZ28vcGFja2FnZXMvZW1haWwtdGVtcGxhdGVzL3BsdWdpbi5tanNcIjtjb25zdCBfX2luamVjdGVkX2Rpcm5hbWVfXyA9IFwiL1VzZXJzL2poZXJtYS9XZWJzdG9ybVByb2plY3RzL21lbnRpbmdvL3BhY2thZ2VzL2VtYWlsLXRlbXBsYXRlc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvamhlcm1hL1dlYnN0b3JtUHJvamVjdHMvbWVudGluZ28vcGFja2FnZXMvZW1haWwtdGVtcGxhdGVzL3BsdWdpbi5tanNcIjtpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0ICogYXMgcGFyc2VyIGZyb20gXCJAYmFiZWwvcGFyc2VyXCI7XG5pbXBvcnQgX3RyYXZlcnNlIGZyb20gXCJAYmFiZWwvdHJhdmVyc2VcIjtcbmltcG9ydCBfZ2VuZXJhdGUgZnJvbSBcIkBiYWJlbC9nZW5lcmF0b3JcIjtcbmltcG9ydCAqIGFzIHQgZnJvbSBcIkBiYWJlbC90eXBlc1wiO1xuXG5jb25zdCB0cmF2ZXJzZSA9IF90cmF2ZXJzZS5kZWZhdWx0O1xuY29uc3QgZ2VuZXJhdGUgPSBfZ2VuZXJhdGUuZGVmYXVsdDtcblxuY29uc3QgZ2VuZXJhdGVJbmRleENvbnRlbnQgPSAoKSA9PiB7XG4gIGNvbnN0IHRlbXBsYXRlc0RpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBcInNyY1wiLCBcInRlbXBsYXRlc1wiKTtcblxuICBjb25zdCB0ZW1wbGF0ZUZpbGVzID0gZnNcbiAgICAucmVhZGRpclN5bmModGVtcGxhdGVzRGlyKVxuICAgIC5maWx0ZXIoKGZpbGUpID0+IGZpbGUuZW5kc1dpdGgoXCIudHN4XCIpICYmIGZpbGUgIT09IFwiaW5kZXgudHNcIik7XG5cbiAgY29uc3QgYXN0ID0gcGFyc2VyLnBhcnNlKFwiXCIsIHtcbiAgICBzb3VyY2VUeXBlOiBcIm1vZHVsZVwiLFxuICAgIHBsdWdpbnM6IFtcInR5cGVzY3JpcHRcIl0sXG4gIH0pO1xuXG4gIHRyYXZlcnNlKGFzdCwge1xuICAgIFByb2dyYW0ocGF0aCkge1xuICAgICAgY29uc3QgZmFjdG9yeUltcG9ydCA9IHQuaW1wb3J0RGVjbGFyYXRpb24oXG4gICAgICAgIFtcbiAgICAgICAgICB0LmltcG9ydFNwZWNpZmllcihcbiAgICAgICAgICAgIHQuaWRlbnRpZmllcihcImVtYWlsVGVtcGxhdGVGYWN0b3J5XCIpLFxuICAgICAgICAgICAgdC5pZGVudGlmaWVyKFwiZW1haWxUZW1wbGF0ZUZhY3RvcnlcIilcbiAgICAgICAgICApLFxuICAgICAgICBdLFxuICAgICAgICB0LnN0cmluZ0xpdGVyYWwoXCIuL2VtYWlsLWZhY3RvcnlcIilcbiAgICAgICk7XG4gICAgICBwYXRoLnB1c2hDb250YWluZXIoXCJib2R5XCIsIGZhY3RvcnlJbXBvcnQpO1xuXG4gICAgICB0ZW1wbGF0ZUZpbGVzLmZvckVhY2goKHRlbXBsYXRlRmlsZSkgPT4ge1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSB0ZW1wbGF0ZUZpbGUucmVwbGFjZShcIi50c3hcIiwgXCJcIik7XG4gICAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9XG4gICAgICAgICAgdGVtcGxhdGVOYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgdGVtcGxhdGVOYW1lLnNsaWNlKDEpO1xuXG4gICAgICAgIGNvbnN0IGltcG9ydERlY2xhcmF0aW9uID0gdC5pbXBvcnREZWNsYXJhdGlvbihcbiAgICAgICAgICBbdC5pbXBvcnREZWZhdWx0U3BlY2lmaWVyKHQuaWRlbnRpZmllcihgJHt2YXJpYWJsZU5hbWV9VGVtcGxhdGVgKSldLFxuICAgICAgICAgIHQuc3RyaW5nTGl0ZXJhbChgLi90ZW1wbGF0ZXMvJHt0ZW1wbGF0ZU5hbWV9YClcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBleHBvcnREZWNsYXJhdGlvbiA9IHQuZXhwb3J0TmFtZWREZWNsYXJhdGlvbihcbiAgICAgICAgICB0LnZhcmlhYmxlRGVjbGFyYXRpb24oXCJjb25zdFwiLCBbXG4gICAgICAgICAgICB0LnZhcmlhYmxlRGVjbGFyYXRvcihcbiAgICAgICAgICAgICAgdC5pZGVudGlmaWVyKHZhcmlhYmxlTmFtZSksXG4gICAgICAgICAgICAgIHQuY2FsbEV4cHJlc3Npb24odC5pZGVudGlmaWVyKFwiZW1haWxUZW1wbGF0ZUZhY3RvcnlcIiksIFtcbiAgICAgICAgICAgICAgICB0LmlkZW50aWZpZXIoYCR7dmFyaWFibGVOYW1lfVRlbXBsYXRlYCksXG4gICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICApLFxuICAgICAgICAgIF0pXG4gICAgICAgICk7XG5cbiAgICAgICAgcGF0aC5wdXNoQ29udGFpbmVyKFwiYm9keVwiLCBpbXBvcnREZWNsYXJhdGlvbik7XG4gICAgICAgIHBhdGgucHVzaENvbnRhaW5lcihcImJvZHlcIiwgZXhwb3J0RGVjbGFyYXRpb24pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3Qgb3V0cHV0ID0gZ2VuZXJhdGUoXG4gICAgYXN0LFxuICAgIHtcbiAgICAgIHJldGFpbkxpbmVzOiBmYWxzZSxcbiAgICAgIGNvbmNpc2U6IGZhbHNlLFxuICAgICAgZGVjb3JhdG9yc0JlZm9yZUV4cG9ydDogdHJ1ZSxcbiAgICAgIGpzZXNjT3B0aW9uOiB7XG4gICAgICAgIG1pbmltYWw6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgYXN0LnByb2dyYW1cbiAgKTtcblxuICByZXR1cm4gb3V0cHV0LmNvZGU7XG59O1xuXG5jb25zdCB0c3VwUGx1Z2luID0gKCkgPT4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6IFwiZHluYW1pYy10ZW1wbGF0ZS1leHBvcnRzXCIsXG4gICAgYnVpbGRFbmQ6ICgpID0+IHtcbiAgICAgIGNvbnN0IGluZGV4RmlsZVBhdGggPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgXCJzcmNcIiwgXCJpbmRleC50c1wiKTtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBnZW5lcmF0ZUluZGV4Q29udGVudCgpO1xuXG4gICAgICBmcy53cml0ZUZpbGVTeW5jKGluZGV4RmlsZVBhdGgsIGNvbnRlbnQsIFwidXRmLThcIik7XG4gICAgICBjb25zb2xlLmxvZyhgR2VuZXJhdGVkICR7aW5kZXhGaWxlUGF0aH0uYCk7XG5cbiAgICAgIGNvbnN0IHNhdmVkQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhpbmRleEZpbGVQYXRoLCBcInV0Zi04XCIpO1xuXG4gICAgICBpZiAoY29udGVudCAhPT0gc2F2ZWRDb250ZW50KSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvcjogU2F2ZWQgY29udGVudCBkb2VzIG5vdCBtYXRjaCBnZW5lcmF0ZWQgY29udGVudCFcIik7XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IHRzdXBQbHVnaW47XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThVLFNBQVMsb0JBQWtDOzs7QUNBbkQsT0FBTyxVQUFVO0FBQ3ZWLE9BQU8sUUFBUTtBQUNmLFlBQVksWUFBWTtBQUN4QixPQUFPLGVBQWU7QUFDdEIsT0FBTyxlQUFlO0FBQ3RCLFlBQVksT0FBTztBQUVuQixJQUFNLFdBQVcsVUFBVTtBQUMzQixJQUFNLFdBQVcsVUFBVTtBQUUzQixJQUFNLHVCQUF1QixNQUFNO0FBQ2pDLFFBQU0sZUFBZSxLQUFLLFFBQVEsUUFBUSxJQUFJLEdBQUcsT0FBTyxXQUFXO0FBRW5FLFFBQU0sZ0JBQWdCLEdBQ25CLFlBQVksWUFBWSxFQUN4QixPQUFPLENBQUMsU0FBUyxLQUFLLFNBQVMsTUFBTSxLQUFLLFNBQVMsVUFBVTtBQUVoRSxRQUFNLE1BQWEsYUFBTSxJQUFJO0FBQUEsSUFDM0IsWUFBWTtBQUFBLElBQ1osU0FBUyxDQUFDLFlBQVk7QUFBQSxFQUN4QixDQUFDO0FBRUQsV0FBUyxLQUFLO0FBQUEsSUFDWixRQUFRQSxPQUFNO0FBQ1osWUFBTSxnQkFBa0I7QUFBQSxRQUN0QjtBQUFBLFVBQ0k7QUFBQSxZQUNFLGFBQVcsc0JBQXNCO0FBQUEsWUFDakMsYUFBVyxzQkFBc0I7QUFBQSxVQUNyQztBQUFBLFFBQ0Y7QUFBQSxRQUNFLGdCQUFjLGlCQUFpQjtBQUFBLE1BQ25DO0FBQ0EsTUFBQUEsTUFBSyxjQUFjLFFBQVEsYUFBYTtBQUV4QyxvQkFBYyxRQUFRLENBQUMsaUJBQWlCO0FBQ3RDLGNBQU0sZUFBZSxhQUFhLFFBQVEsUUFBUSxFQUFFO0FBQ3BELGNBQU0sZUFDSixhQUFhLE9BQU8sQ0FBQyxFQUFFLFlBQVksSUFBSSxhQUFhLE1BQU0sQ0FBQztBQUU3RCxjQUFNQyxxQkFBc0I7QUFBQSxVQUMxQixDQUFHLHlCQUF5QixhQUFXLEdBQUcsWUFBWSxVQUFVLENBQUMsQ0FBQztBQUFBLFVBQ2hFLGdCQUFjLGVBQWUsWUFBWSxFQUFFO0FBQUEsUUFDL0M7QUFFQSxjQUFNLG9CQUFzQjtBQUFBLFVBQ3hCLHNCQUFvQixTQUFTO0FBQUEsWUFDM0I7QUFBQSxjQUNFLGFBQVcsWUFBWTtBQUFBLGNBQ3ZCLGlCQUFpQixhQUFXLHNCQUFzQixHQUFHO0FBQUEsZ0JBQ25ELGFBQVcsR0FBRyxZQUFZLFVBQVU7QUFBQSxjQUN4QyxDQUFDO0FBQUEsWUFDSDtBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0g7QUFFQSxRQUFBRCxNQUFLLGNBQWMsUUFBUUMsa0JBQWlCO0FBQzVDLFFBQUFELE1BQUssY0FBYyxRQUFRLGlCQUFpQjtBQUFBLE1BQzlDLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRixDQUFDO0FBRUQsUUFBTSxTQUFTO0FBQUEsSUFDYjtBQUFBLElBQ0E7QUFBQSxNQUNFLGFBQWE7QUFBQSxNQUNiLFNBQVM7QUFBQSxNQUNULHdCQUF3QjtBQUFBLE1BQ3hCLGFBQWE7QUFBQSxRQUNYLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRjtBQUFBLElBQ0EsSUFBSTtBQUFBLEVBQ047QUFFQSxTQUFPLE9BQU87QUFDaEI7QUFFQSxJQUFNLGFBQWEsTUFBTTtBQUN2QixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixVQUFVLE1BQU07QUFDZCxZQUFNLGdCQUFnQixLQUFLLFFBQVEsUUFBUSxJQUFJLEdBQUcsT0FBTyxVQUFVO0FBQ25FLFlBQU0sVUFBVSxxQkFBcUI7QUFFckMsU0FBRyxjQUFjLGVBQWUsU0FBUyxPQUFPO0FBQ2hELGNBQVEsSUFBSSxhQUFhLGFBQWEsR0FBRztBQUV6QyxZQUFNLGVBQWUsR0FBRyxhQUFhLGVBQWUsT0FBTztBQUUzRCxVQUFJLFlBQVksY0FBYztBQUM1QixnQkFBUSxNQUFNLHdEQUF3RDtBQUFBLE1BQ3hFO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8saUJBQVE7OztBRDlGZixJQUFPLHNCQUFRLGFBQWEsT0FBTyxZQUFxQjtBQUN0RCxTQUFPO0FBQUEsSUFDTCxPQUFPLENBQUMsZ0JBQWdCO0FBQUEsSUFDeEIsUUFBUSxDQUFDLE9BQU8sS0FBSztBQUFBLElBQ3JCLFNBQVMsQ0FBQyxlQUFXLENBQUM7QUFBQSxJQUN0QixPQUFPO0FBQUEsSUFDUCxLQUFLO0FBQUEsSUFDTCxHQUFHO0FBQUEsRUFDTDtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInBhdGgiLCAiaW1wb3J0RGVjbGFyYXRpb24iXQp9Cg==
