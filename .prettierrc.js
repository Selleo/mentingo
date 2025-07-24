/** @type {import('prettier').Config} */
module.exports = {
  trailingComma: "all",
  singleQuote: false,
  semi: true,
  printWidth: 100,
  useTabs: false,
  tabWidth: 2,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  quoteProps: "as-needed",
  endOfLine: "auto",
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
      options: {
        plugins: ["prettier-plugin-tailwindcss"],
        tailwindConfig: "./apps/web/tailwind.config.ts",
      },
    },
  ],
};
