export default {
  "apps/web/**/*.{ts,tsx}": [
    "pnpm exec tsc-files --noEmit --project apps/web/tsconfig.json",
    "pnpm --filter=web exec eslint --cache",
  ],
  "apps/api/**/*.{ts,tsx}": [
    "pnpm exec tsc-files --noEmit --project apps/api/tsconfig.json",
    "pnpm --filter=api exec eslint --cache",
  ],
  "*.{js,jsx,ts,tsx}": ["pnpm exec prettier --check"],
  "*.{json,md,css,scss,html,yml,yaml}": ["pnpm exec prettier --check"],
};
