module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import", "unused-imports"],
  extends: ["plugin:@typescript-eslint/recommended", "plugin:import/typescript"],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [".eslintrc.js"],
  settings: {
    // Treat "src/**" as internal so external vs internal get an empty line
    "import/internal-regex": "^src/",
    "import/resolver": {
      typescript: true,
      node: true,
    },
  },
  rules: {
    "import/no-duplicates": ["error", { considerQueryString: true }],
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      },
    ],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        prefer: "type-imports",
        fixStyle: "separate-type-imports",
        disallowTypeAnnotations: false,
      },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "@typescript-eslint/no-import-type-side-effects": "error",
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "unused-imports/no-unused-imports": "error",
  },
  overrides: [
    {
      files: [
        "src/seed/**/*.ts",
        "src/stripe/stripe.controller.ts",
        "src/stripe/stripeWebhook.handler.ts",
        "test/jest-setup.ts",
        "test/test-database.ts",
        "test/jest-e2e-setup.ts",
      ],
      rules: {
        "no-console": "off",
      },
    },
  ],
};
