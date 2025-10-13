import * as fs from "fs";
import { sync as globSync } from "glob";
import * as path from "path";

const generateCentralBarrel = () => {
  const srcDir = path.resolve(process.cwd(), "src");
  const files = globSync("**/*.{ts,tsx}", {
    cwd: srcDir,
    ignore: ["**/index.ts", "**/*.d.ts"],
  });

  files.sort();

  const exportStatements = files
    .map((file) => {
      const withoutExt = file.replace(/\.(ts|tsx)$/, "");
      return `export * from "./${withoutExt}";`;
    })
    .join("\n");

  return exportStatements + "\n";
};

const tsupBarrelPlugin = () => {
  return {
    name: "tsup-barrel-plugin",
    buildEnd: async () => {
      const indexFilePath = path.resolve(process.cwd(), "src", "index.ts");
      const newContent = generateCentralBarrel();

      let currentContent = "";

      try {
        currentContent = fs.readFileSync(indexFilePath, "utf8");
      } catch (err) {
        console.log(err);
      }

      if (currentContent === newContent) {
        console.log("Barrel file unchanged, skipping write");
      } else {
        fs.writeFileSync(indexFilePath, newContent, "utf8");
        console.log(`Generated central barrel at ${indexFilePath}`);
      }
    },
  };
};

export default tsupBarrelPlugin;
