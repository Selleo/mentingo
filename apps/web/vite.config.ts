import path from "path";

import { vitePlugin as remix } from "@remix-run/dev";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, loadEnv } from "vite";
import { cjsInterop } from "vite-plugin-cjs-interop";
import { viteStaticCopy } from "vite-plugin-static-copy";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

import { routes } from "./routes";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      svgr(),
      cjsInterop({
        dependencies: ["react-use"],
      }),
      remix({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_singleFetch: true,
        },
        ssr: false, // SPA MODE - Might migrate to React Router 7
        routes,
      }),
      viteStaticCopy({
        targets: [
          {
            src: "app/assets/favicon.ico",
            dest: "",
          },
          {
            src: "app/locales/en/translation.json",
            dest: "locales/en",
          },
          {
            src: "app/locales/pl/translation.json",
            dest: "locales/pl",
          },
        ],
      }),
      tsconfigPaths(),
      sentryVitePlugin({
        org: env.VITE_SENTRY_ORG,
        project: env.VITE_SENTRY_PROJECT,
        authToken: env.VITE_SENTRY_AUTH_TOKEN,
        sourcemaps: {
          assets: "./build/client/**",
        },
        telemetry: false,
      }),
    ],
    ssr: {
      noExternal: ["posthog-js", "posthog-js/react", "react-easy-crop"],
    },
    // https://github.com/remix-run/remix/issues/10156
    server: {
      warmup: {
        clientFiles: ["./app/**/*.tsx"],
      },
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "~/": path.resolve(__dirname, "./app"),
      },
    },
    build: {
      outDir: "build",
      sourcemap: true,
      rollupOptions: {
        external: ["fsevents"],
        output: {
          manualChunks: (id) => {
            if (id.includes("@remix-run")) {
              return "remix";
            }
          },
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/node_modules\/posthog-js/, /node_modules\/posthog-js\/react/, /node_modules/],
      },
    },
    optimizeDeps: {
      include: ["@remix-run/react", "crypto-js", "posthog-js", "posthog-js/react"],
      exclude: ["fsevents"],
    },
  };
});
