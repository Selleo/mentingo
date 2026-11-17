/**
 * This is intended to be a basic starting point for linting in your app.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  ignorePatterns: ["!**/.server", "!**/.client"],

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
        "import/resolver": {
          typescript: {},
        },
      },
      rules: {
        "import/no-duplicates": "error",
        "import/order": [
          "error",
          {
            groups: [
              "builtin",
              "external",
              "internal",
              "parent",
              "sibling",
              "index",
              "object",
              "type",
            ],
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
        "@typescript-eslint/no-import-type-side-effects": "error",
        "react/prop-types": "off",
        "react/display-name": "off",
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "ConditionalExpression[alternate.type='Literal'][alternate.value=null][consequent.type='JSXElement']",
            message: "Use && instead of a JSX ternary with null as the alternate.",
          },
          {
            selector:
              "ConditionalExpression[alternate.type='Literal'][alternate.value=null][consequent.type='JSXFragment']",
            message: "Use && instead of a JSX ternary with null as the alternate.",
          },
        ],
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
      ],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
      },
    },

    // E2E specs: see e2e/strategy.md. Warnings until the existing suite is migrated.
    {
      files: ["e2e/specs/**/*.ts"],
      rules: {
        "no-restricted-syntax": [
          "warn",
          {
            selector: "CallExpression[callee.property.name='getByText']",
            message: "Do not select by copy; use getByTestId with a handle (e2e/strategy.md §8).",
          },
          {
            selector:
              "CallExpression[callee.property.name='getByTestId'][arguments.0.type=/^(Literal|TemplateLiteral)$/]",
            message:
              "Do not pass a string to getByTestId; use a handle from data/<domain>/handles.ts (e2e/strategy.md §8).",
          },
          {
            selector:
              "CallExpression[callee.property.name='getByRole'] > ObjectExpression.arguments > Property[key.name='name']",
            message:
              "Do not select by role name (copy); use getByTestId with a handle (e2e/strategy.md §8).",
          },
          {
            selector:
              "CallExpression[callee.object.name='test'][callee.property.name=/^(skip|fixme)$/]:matches([arguments.length=0], [arguments.0.type=/^(Literal|TemplateLiteral)$/])",
            message:
              "No unconditional test.skip/test.fixme; fix or delete the test, or skip conditionally with a reason (e2e/strategy.md §10).",
          },
          {
            selector:
              "CallExpression[callee.object.property.name='describe'][callee.property.name=/^(skip|fixme)$/]",
            message:
              "No unconditional test.describe.skip/fixme; fix or delete the tests (e2e/strategy.md §10).",
          },
        ],
        "no-restricted-properties": [
          "warn",
          {
            object: "page",
            property: "route",
            message: "Do not mock in specs; use the domain mock flow (e2e/strategy.md §9).",
          },
        ],
      },
    },

    // Node
    {
      files: [".eslintrc.cjs", "server.js"],
      env: {
        node: true,
      },
    },
  ],
};
