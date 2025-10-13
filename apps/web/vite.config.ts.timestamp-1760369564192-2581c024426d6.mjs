// vite.config.ts
import path from "path";
import { vitePlugin as remix } from "file:///media/jakub/files/projects/work/mentingo/node_modules/.pnpm/@remix-run+dev@2.15.0_@remix-run+react@2.15.0_react-dom@18.3.1_react@18.3.1__react@18.3_5a2604a42105a534fb46ec3e7289aa1b/node_modules/@remix-run/dev/dist/index.js";
import { sentryVitePlugin } from "file:///media/jakub/files/projects/work/mentingo/node_modules/.pnpm/@sentry+vite-plugin@2.22.6/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import { defineConfig, loadEnv } from "file:///media/jakub/files/projects/work/mentingo/node_modules/.pnpm/vite@5.4.11_@types+node@20.17.6_terser@5.36.0/node_modules/vite/dist/node/index.js";
import { cjsInterop } from "file:///media/jakub/files/projects/work/mentingo/node_modules/.pnpm/vite-plugin-cjs-interop@2.1.4/node_modules/vite-plugin-cjs-interop/dist/index.js";
import { viteStaticCopy } from "file:///media/jakub/files/projects/work/mentingo/node_modules/.pnpm/vite-plugin-static-copy@1.0.6_vite@5.4.11_@types+node@20.17.6_terser@5.36.0_/node_modules/vite-plugin-static-copy/dist/index.js";
import svgr from "file:///media/jakub/files/projects/work/mentingo/node_modules/.pnpm/vite-plugin-svgr@4.2.0_rollup@4.27.4_typescript@5.4.5_vite@5.4.11_@types+node@20.17.6_terser@5.36.0_/node_modules/vite-plugin-svgr/dist/index.js";
import tsconfigPaths from "file:///media/jakub/files/projects/work/mentingo/node_modules/.pnpm/vite-tsconfig-paths@5.0.0_typescript@5.4.5_vite@5.4.11_@types+node@20.17.6_terser@5.36.0_/node_modules/vite-tsconfig-paths/dist/index.js";

// routes.ts
var routes = (defineRoutes) => {
  return defineRoutes((route) => {
    route("auth", "modules/Auth/Auth.layout.tsx", () => {
      route("login", "modules/Auth/Login.page.tsx", { index: true });
      route("register", "modules/Auth/Register.page.tsx");
      route("create-new-password", "modules/Auth/CreateNewPassword.page.tsx");
      route("password-recovery", "modules/Auth/PasswordRecovery.page.tsx");
      route("mfa", "modules/Auth/MFA.page.tsx");
    });
    route("", "modules/Dashboard/PublicDashboard.layout.tsx", () => {
      route("courses", "modules/Courses/Courses.page.tsx");
      route("course/:id", "modules/Courses/CourseView/CourseView.page.tsx");
      route("profile/:id", "modules/Profile/Profile.page.tsx");
    });
    route("", "modules/Dashboard/UserDashboard.layout.tsx", () => {
      route("", "modules/Statistics/Statistics.page.tsx", {
        index: true
      });
      route("settings", "modules/Dashboard/Settings/Settings.page.tsx");
      route("provider-information", "modules/ProviderInformation/ProviderInformation.page.tsx");
      route("announcements", "modules/Announcements/Announcements.page.tsx");
    });
    route("course/:courseId/lesson", "modules/Courses/Lesson/Lesson.layout.tsx", () => {
      route(":lessonId", "modules/Courses/Lesson/Lesson.page.tsx");
    });
    route("admin", "modules/Admin/Admin.layout.tsx", () => {
      route("courses", "modules/Admin/Courses/Courses.page.tsx", {
        index: true
      });
      route("envs", "modules/Admin/Envs/Envs.page.tsx");
      route("beta-courses/new", "modules/Admin/AddCourse/AddCourse.tsx");
      route("courses/new-scorm", "modules/Admin/Scorm/CreateNewScormCourse.page.tsx");
      route("beta-courses/:id", "modules/Admin/EditCourse/EditCourse.tsx");
      route("users", "modules/Admin/Users/Users.page.tsx");
      route("users/:id", "modules/Admin/Users/User.page.tsx");
      route("users/new", "modules/Admin/Users/CreateNewUser.page.tsx");
      route("categories", "modules/Admin/Categories/Categories.page.tsx");
      route("categories/:id", "modules/Admin/Categories/Category.page.tsx");
      route("categories/new", "modules/Admin/Categories/CreateNewCategory.page.tsx");
      route("groups", "modules/Admin/Groups/Groups.page.tsx");
      route("groups/new", "modules/Admin/Groups/CreateGroup.page.tsx");
      route("groups/:id", "modules/Admin/Groups/EditGroup.page.tsx");
      route("announcements/new", "modules/Announcements/CreateAnnouncement.page.tsx");
      route("promotion-codes", "modules/Admin/PromotionCodes/PromotionCodes.page.tsx");
      route("promotion-codes/new", "modules/Admin/PromotionCodes/CreatePromotionCode.page.tsx");
      route("promotion-codes/:id", "modules/Admin/PromotionCodes/PromotionCodeDetails.page.tsx");
    });
  });
};

// vite.config.ts
var __vite_injected_original_dirname = "/media/jakub/files/projects/work/mentingo/apps/web";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    ssr: {
      noExternal: ["react-easy-crop"]
    },
    plugins: [
      svgr(),
      cjsInterop({
        dependencies: ["react-use"]
      }),
      remix({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_singleFetch: true
        },
        ssr: false,
        // SPA MODE - Might migrate to React Router 7
        routes
      }),
      viteStaticCopy({
        targets: [
          {
            src: "app/assets/favicon.ico",
            dest: ""
          },
          {
            src: "app/locales/en/translation.json",
            dest: "locales/en"
          },
          {
            src: "app/locales/pl/translation.json",
            dest: "locales/pl"
          }
        ]
      }),
      tsconfigPaths(),
      sentryVitePlugin({
        org: env.VITE_SENTRY_ORG,
        project: env.VITE_SENTRY_PROJECT,
        authToken: env.VITE_SENTRY_AUTH_TOKEN,
        sourcemaps: {
          assets: "./build/client/**"
        },
        telemetry: false
      })
    ],
    // https://github.com/remix-run/remix/issues/10156
    server: {
      warmup: {
        clientFiles: ["./app/**/*.tsx"]
      },
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true
        }
      }
    },
    resolve: {
      alias: {
        "~/": path.resolve(__vite_injected_original_dirname, "./app")
      }
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
          }
        }
      },
      commonjsOptions: {
        transformMixedEsModules: true
      }
    },
    optimizeDeps: {
      include: ["@remix-run/react", "crypto-js"],
      exclude: ["fsevents"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicm91dGVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL21lZGlhL2pha3ViL2ZpbGVzL3Byb2plY3RzL3dvcmsvbWVudGluZ28vYXBwcy93ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9tZWRpYS9qYWt1Yi9maWxlcy9wcm9qZWN0cy93b3JrL21lbnRpbmdvL2FwcHMvd2ViL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9tZWRpYS9qYWt1Yi9maWxlcy9wcm9qZWN0cy93b3JrL21lbnRpbmdvL2FwcHMvd2ViL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxuaW1wb3J0IHsgdml0ZVBsdWdpbiBhcyByZW1peCB9IGZyb20gXCJAcmVtaXgtcnVuL2RldlwiO1xuaW1wb3J0IHsgc2VudHJ5Vml0ZVBsdWdpbiB9IGZyb20gXCJAc2VudHJ5L3ZpdGUtcGx1Z2luXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgY2pzSW50ZXJvcCB9IGZyb20gXCJ2aXRlLXBsdWdpbi1janMtaW50ZXJvcFwiO1xuaW1wb3J0IHsgdml0ZVN0YXRpY0NvcHkgfSBmcm9tIFwidml0ZS1wbHVnaW4tc3RhdGljLWNvcHlcIjtcbmltcG9ydCBzdmdyIGZyb20gXCJ2aXRlLXBsdWdpbi1zdmdyXCI7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuXG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi9yb3V0ZXNcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xuXG4gIHJldHVybiB7XG4gICAgc3NyOiB7XG4gICAgICBub0V4dGVybmFsOiBbXCJyZWFjdC1lYXN5LWNyb3BcIl0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICBzdmdyKCksXG4gICAgICBjanNJbnRlcm9wKHtcbiAgICAgICAgZGVwZW5kZW5jaWVzOiBbXCJyZWFjdC11c2VcIl0sXG4gICAgICB9KSxcbiAgICAgIHJlbWl4KHtcbiAgICAgICAgZnV0dXJlOiB7XG4gICAgICAgICAgdjNfZmV0Y2hlclBlcnNpc3Q6IHRydWUsXG4gICAgICAgICAgdjNfcmVsYXRpdmVTcGxhdFBhdGg6IHRydWUsXG4gICAgICAgICAgdjNfdGhyb3dBYm9ydFJlYXNvbjogdHJ1ZSxcbiAgICAgICAgICB2M19zaW5nbGVGZXRjaDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgc3NyOiBmYWxzZSwgLy8gU1BBIE1PREUgLSBNaWdodCBtaWdyYXRlIHRvIFJlYWN0IFJvdXRlciA3XG4gICAgICAgIHJvdXRlcyxcbiAgICAgIH0pLFxuICAgICAgdml0ZVN0YXRpY0NvcHkoe1xuICAgICAgICB0YXJnZXRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiBcImFwcC9hc3NldHMvZmF2aWNvbi5pY29cIixcbiAgICAgICAgICAgIGRlc3Q6IFwiXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6IFwiYXBwL2xvY2FsZXMvZW4vdHJhbnNsYXRpb24uanNvblwiLFxuICAgICAgICAgICAgZGVzdDogXCJsb2NhbGVzL2VuXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6IFwiYXBwL2xvY2FsZXMvcGwvdHJhbnNsYXRpb24uanNvblwiLFxuICAgICAgICAgICAgZGVzdDogXCJsb2NhbGVzL3BsXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAgdHNjb25maWdQYXRocygpLFxuICAgICAgc2VudHJ5Vml0ZVBsdWdpbih7XG4gICAgICAgIG9yZzogZW52LlZJVEVfU0VOVFJZX09SRyxcbiAgICAgICAgcHJvamVjdDogZW52LlZJVEVfU0VOVFJZX1BST0pFQ1QsXG4gICAgICAgIGF1dGhUb2tlbjogZW52LlZJVEVfU0VOVFJZX0FVVEhfVE9LRU4sXG4gICAgICAgIHNvdXJjZW1hcHM6IHtcbiAgICAgICAgICBhc3NldHM6IFwiLi9idWlsZC9jbGllbnQvKipcIixcbiAgICAgICAgfSxcbiAgICAgICAgdGVsZW1ldHJ5OiBmYWxzZSxcbiAgICAgIH0pLFxuICAgIF0sXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3JlbWl4LXJ1bi9yZW1peC9pc3N1ZXMvMTAxNTZcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHdhcm11cDoge1xuICAgICAgICBjbGllbnRGaWxlczogW1wiLi9hcHAvKiovKi50c3hcIl0sXG4gICAgICB9LFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgIFwifi9cIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL2FwcFwiKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBidWlsZDoge1xuICAgICAgb3V0RGlyOiBcImJ1aWxkXCIsXG4gICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIGV4dGVybmFsOiBbXCJmc2V2ZW50c1wiXSxcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IHtcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkByZW1peC1ydW5cIikpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFwicmVtaXhcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGNvbW1vbmpzT3B0aW9uczoge1xuICAgICAgICB0cmFuc2Zvcm1NaXhlZEVzTW9kdWxlczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIGluY2x1ZGU6IFtcIkByZW1peC1ydW4vcmVhY3RcIiwgXCJjcnlwdG8tanNcIl0sXG4gICAgICBleGNsdWRlOiBbXCJmc2V2ZW50c1wiXSxcbiAgICB9LFxuICB9O1xufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9tZWRpYS9qYWt1Yi9maWxlcy9wcm9qZWN0cy93b3JrL21lbnRpbmdvL2FwcHMvd2ViXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvbWVkaWEvamFrdWIvZmlsZXMvcHJvamVjdHMvd29yay9tZW50aW5nby9hcHBzL3dlYi9yb3V0ZXMudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL21lZGlhL2pha3ViL2ZpbGVzL3Byb2plY3RzL3dvcmsvbWVudGluZ28vYXBwcy93ZWIvcm91dGVzLnRzXCI7aW1wb3J0IHR5cGUgeyBEZWZpbmVSb3V0ZUZ1bmN0aW9uLCBSb3V0ZU1hbmlmZXN0IH0gZnJvbSBcIkByZW1peC1ydW4vZGV2L2Rpc3QvY29uZmlnL3JvdXRlc1wiO1xuXG5leHBvcnQgY29uc3Qgcm91dGVzOiAoXG4gIGRlZmluZVJvdXRlczogKGNhbGxiYWNrOiAoZGVmaW5lUm91dGU6IERlZmluZVJvdXRlRnVuY3Rpb24pID0+IHZvaWQpID0+IFJvdXRlTWFuaWZlc3QsXG4pID0+IFJvdXRlTWFuaWZlc3QgfCBQcm9taXNlPFJvdXRlTWFuaWZlc3Q+ID0gKGRlZmluZVJvdXRlcykgPT4ge1xuICByZXR1cm4gZGVmaW5lUm91dGVzKChyb3V0ZSkgPT4ge1xuICAgIHJvdXRlKFwiYXV0aFwiLCBcIm1vZHVsZXMvQXV0aC9BdXRoLmxheW91dC50c3hcIiwgKCkgPT4ge1xuICAgICAgcm91dGUoXCJsb2dpblwiLCBcIm1vZHVsZXMvQXV0aC9Mb2dpbi5wYWdlLnRzeFwiLCB7IGluZGV4OiB0cnVlIH0pO1xuICAgICAgcm91dGUoXCJyZWdpc3RlclwiLCBcIm1vZHVsZXMvQXV0aC9SZWdpc3Rlci5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwiY3JlYXRlLW5ldy1wYXNzd29yZFwiLCBcIm1vZHVsZXMvQXV0aC9DcmVhdGVOZXdQYXNzd29yZC5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwicGFzc3dvcmQtcmVjb3ZlcnlcIiwgXCJtb2R1bGVzL0F1dGgvUGFzc3dvcmRSZWNvdmVyeS5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwibWZhXCIsIFwibW9kdWxlcy9BdXRoL01GQS5wYWdlLnRzeFwiKTtcbiAgICB9KTtcbiAgICByb3V0ZShcIlwiLCBcIm1vZHVsZXMvRGFzaGJvYXJkL1B1YmxpY0Rhc2hib2FyZC5sYXlvdXQudHN4XCIsICgpID0+IHtcbiAgICAgIHJvdXRlKFwiY291cnNlc1wiLCBcIm1vZHVsZXMvQ291cnNlcy9Db3Vyc2VzLnBhZ2UudHN4XCIpO1xuICAgICAgcm91dGUoXCJjb3Vyc2UvOmlkXCIsIFwibW9kdWxlcy9Db3Vyc2VzL0NvdXJzZVZpZXcvQ291cnNlVmlldy5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwicHJvZmlsZS86aWRcIiwgXCJtb2R1bGVzL1Byb2ZpbGUvUHJvZmlsZS5wYWdlLnRzeFwiKTtcbiAgICB9KTtcbiAgICByb3V0ZShcIlwiLCBcIm1vZHVsZXMvRGFzaGJvYXJkL1VzZXJEYXNoYm9hcmQubGF5b3V0LnRzeFwiLCAoKSA9PiB7XG4gICAgICByb3V0ZShcIlwiLCBcIm1vZHVsZXMvU3RhdGlzdGljcy9TdGF0aXN0aWNzLnBhZ2UudHN4XCIsIHtcbiAgICAgICAgaW5kZXg6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIHJvdXRlKFwic2V0dGluZ3NcIiwgXCJtb2R1bGVzL0Rhc2hib2FyZC9TZXR0aW5ncy9TZXR0aW5ncy5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwicHJvdmlkZXItaW5mb3JtYXRpb25cIiwgXCJtb2R1bGVzL1Byb3ZpZGVySW5mb3JtYXRpb24vUHJvdmlkZXJJbmZvcm1hdGlvbi5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwiYW5ub3VuY2VtZW50c1wiLCBcIm1vZHVsZXMvQW5ub3VuY2VtZW50cy9Bbm5vdW5jZW1lbnRzLnBhZ2UudHN4XCIpO1xuICAgIH0pO1xuICAgIHJvdXRlKFwiY291cnNlLzpjb3Vyc2VJZC9sZXNzb25cIiwgXCJtb2R1bGVzL0NvdXJzZXMvTGVzc29uL0xlc3Nvbi5sYXlvdXQudHN4XCIsICgpID0+IHtcbiAgICAgIHJvdXRlKFwiOmxlc3NvbklkXCIsIFwibW9kdWxlcy9Db3Vyc2VzL0xlc3Nvbi9MZXNzb24ucGFnZS50c3hcIik7XG4gICAgfSk7XG4gICAgcm91dGUoXCJhZG1pblwiLCBcIm1vZHVsZXMvQWRtaW4vQWRtaW4ubGF5b3V0LnRzeFwiLCAoKSA9PiB7XG4gICAgICByb3V0ZShcImNvdXJzZXNcIiwgXCJtb2R1bGVzL0FkbWluL0NvdXJzZXMvQ291cnNlcy5wYWdlLnRzeFwiLCB7XG4gICAgICAgIGluZGV4OiB0cnVlLFxuICAgICAgfSk7XG4gICAgICByb3V0ZShcImVudnNcIiwgXCJtb2R1bGVzL0FkbWluL0VudnMvRW52cy5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwiYmV0YS1jb3Vyc2VzL25ld1wiLCBcIm1vZHVsZXMvQWRtaW4vQWRkQ291cnNlL0FkZENvdXJzZS50c3hcIik7XG4gICAgICByb3V0ZShcImNvdXJzZXMvbmV3LXNjb3JtXCIsIFwibW9kdWxlcy9BZG1pbi9TY29ybS9DcmVhdGVOZXdTY29ybUNvdXJzZS5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwiYmV0YS1jb3Vyc2VzLzppZFwiLCBcIm1vZHVsZXMvQWRtaW4vRWRpdENvdXJzZS9FZGl0Q291cnNlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwidXNlcnNcIiwgXCJtb2R1bGVzL0FkbWluL1VzZXJzL1VzZXJzLnBhZ2UudHN4XCIpO1xuICAgICAgcm91dGUoXCJ1c2Vycy86aWRcIiwgXCJtb2R1bGVzL0FkbWluL1VzZXJzL1VzZXIucGFnZS50c3hcIik7XG4gICAgICByb3V0ZShcInVzZXJzL25ld1wiLCBcIm1vZHVsZXMvQWRtaW4vVXNlcnMvQ3JlYXRlTmV3VXNlci5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwiY2F0ZWdvcmllc1wiLCBcIm1vZHVsZXMvQWRtaW4vQ2F0ZWdvcmllcy9DYXRlZ29yaWVzLnBhZ2UudHN4XCIpO1xuICAgICAgcm91dGUoXCJjYXRlZ29yaWVzLzppZFwiLCBcIm1vZHVsZXMvQWRtaW4vQ2F0ZWdvcmllcy9DYXRlZ29yeS5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwiY2F0ZWdvcmllcy9uZXdcIiwgXCJtb2R1bGVzL0FkbWluL0NhdGVnb3JpZXMvQ3JlYXRlTmV3Q2F0ZWdvcnkucGFnZS50c3hcIik7XG4gICAgICByb3V0ZShcImdyb3Vwc1wiLCBcIm1vZHVsZXMvQWRtaW4vR3JvdXBzL0dyb3Vwcy5wYWdlLnRzeFwiKTtcbiAgICAgIHJvdXRlKFwiZ3JvdXBzL25ld1wiLCBcIm1vZHVsZXMvQWRtaW4vR3JvdXBzL0NyZWF0ZUdyb3VwLnBhZ2UudHN4XCIpO1xuICAgICAgcm91dGUoXCJncm91cHMvOmlkXCIsIFwibW9kdWxlcy9BZG1pbi9Hcm91cHMvRWRpdEdyb3VwLnBhZ2UudHN4XCIpO1xuICAgICAgcm91dGUoXCJhbm5vdW5jZW1lbnRzL25ld1wiLCBcIm1vZHVsZXMvQW5ub3VuY2VtZW50cy9DcmVhdGVBbm5vdW5jZW1lbnQucGFnZS50c3hcIik7XG4gICAgICByb3V0ZShcInByb21vdGlvbi1jb2Rlc1wiLCBcIm1vZHVsZXMvQWRtaW4vUHJvbW90aW9uQ29kZXMvUHJvbW90aW9uQ29kZXMucGFnZS50c3hcIik7XG4gICAgICByb3V0ZShcInByb21vdGlvbi1jb2Rlcy9uZXdcIiwgXCJtb2R1bGVzL0FkbWluL1Byb21vdGlvbkNvZGVzL0NyZWF0ZVByb21vdGlvbkNvZGUucGFnZS50c3hcIik7XG4gICAgICByb3V0ZShcInByb21vdGlvbi1jb2Rlcy86aWRcIiwgXCJtb2R1bGVzL0FkbWluL1Byb21vdGlvbkNvZGVzL1Byb21vdGlvbkNvZGVEZXRhaWxzLnBhZ2UudHN4XCIpO1xuICAgIH0pO1xuICB9KTtcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdVLE9BQU8sVUFBVTtBQUV6VixTQUFTLGNBQWMsYUFBYTtBQUNwQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGNBQWMsZUFBZTtBQUN0QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHNCQUFzQjtBQUMvQixPQUFPLFVBQVU7QUFDakIsT0FBTyxtQkFBbUI7OztBQ05uQixJQUFNLFNBRWlDLENBQUMsaUJBQWlCO0FBQzlELFNBQU8sYUFBYSxDQUFDLFVBQVU7QUFDN0IsVUFBTSxRQUFRLGdDQUFnQyxNQUFNO0FBQ2xELFlBQU0sU0FBUywrQkFBK0IsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUM3RCxZQUFNLFlBQVksZ0NBQWdDO0FBQ2xELFlBQU0sdUJBQXVCLHlDQUF5QztBQUN0RSxZQUFNLHFCQUFxQix3Q0FBd0M7QUFDbkUsWUFBTSxPQUFPLDJCQUEyQjtBQUFBLElBQzFDLENBQUM7QUFDRCxVQUFNLElBQUksZ0RBQWdELE1BQU07QUFDOUQsWUFBTSxXQUFXLGtDQUFrQztBQUNuRCxZQUFNLGNBQWMsZ0RBQWdEO0FBQ3BFLFlBQU0sZUFBZSxrQ0FBa0M7QUFBQSxJQUN6RCxDQUFDO0FBQ0QsVUFBTSxJQUFJLDhDQUE4QyxNQUFNO0FBQzVELFlBQU0sSUFBSSwwQ0FBMEM7QUFBQSxRQUNsRCxPQUFPO0FBQUEsTUFDVCxD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
