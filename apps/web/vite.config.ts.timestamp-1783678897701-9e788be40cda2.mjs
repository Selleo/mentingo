// vite.config.ts
import path from "path";
import { vitePlugin as remix } from "file:///home/user/mentingoFinal/mentingo/node_modules/.pnpm/@remix-run+dev@2.15.0_@remix-run+react@2.15.0_react-dom@18.3.1_react@18.3.1__react@18.3_5a2604a42105a534fb46ec3e7289aa1b/node_modules/@remix-run/dev/dist/index.js";
import { sentryVitePlugin } from "file:///home/user/mentingoFinal/mentingo/node_modules/.pnpm/@sentry+vite-plugin@2.22.6/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import { defineConfig, loadEnv } from "file:///home/user/mentingoFinal/mentingo/node_modules/.pnpm/vite@5.4.11_@types+node@20.17.6_terser@5.36.0/node_modules/vite/dist/node/index.js";
import { cjsInterop } from "file:///home/user/mentingoFinal/mentingo/node_modules/.pnpm/vite-plugin-cjs-interop@2.1.4/node_modules/vite-plugin-cjs-interop/dist/index.js";
import { viteStaticCopy } from "file:///home/user/mentingoFinal/mentingo/node_modules/.pnpm/vite-plugin-static-copy@1.0.6_vite@5.4.11_@types+node@20.17.6_terser@5.36.0_/node_modules/vite-plugin-static-copy/dist/index.js";
import svgr from "file:///home/user/mentingoFinal/mentingo/node_modules/.pnpm/vite-plugin-svgr@4.2.0_rollup@4.27.4_typescript@5.4.5_vite@5.4.11_@types+node@20.17.6_terser@5.36.0_/node_modules/vite-plugin-svgr/dist/index.js";
import tsconfigPaths from "file:///home/user/mentingoFinal/mentingo/node_modules/.pnpm/vite-tsconfig-paths@5.0.0_typescript@5.4.5_vite@5.4.11_@types+node@20.17.6_terser@5.36.0_/node_modules/vite-tsconfig-paths/dist/index.js";

// routes.ts
var routes = (defineRoutes) => {
  return defineRoutes((route) => {
    route("", "modules/layout.tsx", () => {
      route("auth", "modules/Auth/Auth.layout.tsx", () => {
        route("login", "modules/Auth/Login.page.tsx", { index: true });
        route("register", "modules/Auth/Register.page.tsx");
        route("create-new-password", "modules/Auth/CreateNewPassword.page.tsx");
        route("password-recovery", "modules/Auth/PasswordRecovery.page.tsx");
        route("magic-link", "modules/Auth/MagicLink.page.tsx");
        route("mfa", "modules/Auth/MFA.page.tsx");
      });
      route("tenant-inactive", "modules/Errors/TenantInactive.page.tsx");
      route("", "modules/Navigation/NavigationWrapper.tsx", () => {
        route("", "modules/Dashboard/PublicDashboard.layout.tsx", () => {
          route("courses", "modules/Courses/Courses.page.tsx");
          route("course/:id", "modules/Courses/CourseView/CourseView.page.tsx");
          route("development-paths", "modules/LearningPaths/LearningPaths.page.tsx");
          route("calendar", "modules/Calendar/Calendar.page.tsx");
          route("live-training/:id/room", "modules/LiveTraining/LiveTraining.page.tsx", {
            id: "live-training-room"
          });
          route("live-training/:id", "modules/LiveTraining/LiveTraining.page.tsx", {
            id: "live-training-details"
          });
          route("qa", "modules/QA/QA.page.tsx");
          route("qa/new", "modules/QA/CreateQA.page.tsx");
          route("qa/:id", "modules/QA/EditQA.page.tsx");
          route("articles", "modules/Articles/Articles.page.tsx");
          route("articles/:articleId", "modules/Articles/ArticleDetails.page.tsx", {
            id: "article-details"
          });
          route("news/:newsId/edit", "modules/News/NewsForm.page.tsx", {
            id: "edit-news"
          });
          route("news/add", "modules/News/NewsForm.page.tsx", {
            id: "add-news"
          });
          route("news", "modules/News/News.page.tsx");
          route("news/:newsId", "modules/News/NewsDetails.page.tsx", {
            id: "news-details"
          });
        });
        route("", "modules/Dashboard/UserDashboard.layout.tsx", () => {
          route("", "modules/Dashboard/IndexRedirect.page.tsx", { index: true });
          route("progress", "modules/Statistics/Statistics.page.tsx");
          route("notifications", "modules/Notifications/Notifications.page.tsx");
          route("settings", "modules/Dashboard/Settings/Settings.page.tsx");
          route("provider-information", "modules/ProviderInformation/ProviderInformation.page.tsx");
          route("articles/:articleId/edit", "modules/Articles/ArticleForm.page.tsx", {
            id: "edit-article"
          });
          route("profile/:id", "modules/Profile/Profile.page.tsx");
        });
        route("course/:courseId/lesson", "modules/Courses/Lesson/Lesson.layout.tsx", () => {
          route(":lessonId", "modules/Courses/Lesson/Lesson.page.tsx");
        });
        route("admin", "modules/Admin/Admin.layout.tsx", () => {
          route("courses", "modules/Admin/Courses/Courses.page.tsx", {
            index: true
          });
          route("analytics", "modules/Statistics/Analytics.page.tsx");
          route("envs", "modules/Admin/Envs/Envs.page.tsx");
          route("beta-courses/new", "modules/Admin/AddCourse/CourseTypeSelector.page.tsx");
          route("beta-courses/new/standard", "modules/Admin/AddCourse/AddCourse.tsx");
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
          route("promotion-codes", "modules/Admin/PromotionCodes/PromotionCodes.page.tsx");
          route("promotion-codes/new", "modules/Admin/PromotionCodes/CreatePromotionCode.page.tsx");
          route(
            "promotion-codes/:id",
            "modules/Admin/PromotionCodes/PromotionCodeDetails.page.tsx"
          );
          route("activity-logs", "modules/ActivityLogs/ActivityLogs.page.tsx");
        });
        route("super-admin", "modules/SuperAdmin/SuperAdmin.layout.tsx", () => {
          route("tenants", "modules/SuperAdmin/Tenants.page.tsx", { index: true });
          route("tenants/new", "modules/SuperAdmin/CreateTenant.page.tsx");
          route("tenants/:id", "modules/SuperAdmin/EditTenant.page.tsx");
        });
      });
    });
  });
};

// vite.config.ts
var __vite_injected_original_dirname = "/home/user/mentingoFinal/mentingo/apps/web";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
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
            src: "app/assets/svgs/app-signet.svg",
            dest: ""
          },
          {
            src: "app/locales/en/translation.json",
            dest: "locales/en"
          },
          {
            src: "app/locales/pl/translation.json",
            dest: "locales/pl"
          },
          ...process.env.NODE_ENV === "production" ? [
            { src: "app/assets/svgs/app-logo.svg", dest: "app/assets/svgs" },
            { src: "app/assets/svgs/app-email-logo.svg", dest: "app/assets/svgs" },
            {
              src: "app/assets/svgs/app-email-border-circle.svg",
              dest: "app/assets/svgs"
            }
          ] : []
        ]
      }),
      tsconfigPaths(),
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          assets: "./build/client/**"
        },
        telemetry: false
      })
    ],
    ssr: {
      noExternal: ["posthog-js", "posthog-js/react", "react-easy-crop"]
    },
    // https://github.com/remix-run/remix/issues/10156
    server: {
      warmup: {
        clientFiles: ["./app/**/*.tsx"]
      },
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          ws: true
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
        transformMixedEsModules: true,
        include: [/node_modules\/posthog-js/, /node_modules\/posthog-js\/react/, /node_modules/]
      }
    },
    optimizeDeps: {
      include: ["@remix-run/react", "crypto-js", "posthog-js", "posthog-js/react"],
      exclude: ["fsevents"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicm91dGVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvdXNlci9tZW50aW5nb0ZpbmFsL21lbnRpbmdvL2FwcHMvd2ViXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS91c2VyL21lbnRpbmdvRmluYWwvbWVudGluZ28vYXBwcy93ZWIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvdXNlci9tZW50aW5nb0ZpbmFsL21lbnRpbmdvL2FwcHMvd2ViL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxuaW1wb3J0IHsgdml0ZVBsdWdpbiBhcyByZW1peCB9IGZyb20gXCJAcmVtaXgtcnVuL2RldlwiO1xuaW1wb3J0IHsgc2VudHJ5Vml0ZVBsdWdpbiB9IGZyb20gXCJAc2VudHJ5L3ZpdGUtcGx1Z2luXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHsgY2pzSW50ZXJvcCB9IGZyb20gXCJ2aXRlLXBsdWdpbi1janMtaW50ZXJvcFwiO1xuaW1wb3J0IHsgdml0ZVN0YXRpY0NvcHkgfSBmcm9tIFwidml0ZS1wbHVnaW4tc3RhdGljLWNvcHlcIjtcbmltcG9ydCBzdmdyIGZyb20gXCJ2aXRlLXBsdWdpbi1zdmdyXCI7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuXG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi9yb3V0ZXNcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW1xuICAgICAgc3ZncigpLFxuICAgICAgY2pzSW50ZXJvcCh7XG4gICAgICAgIGRlcGVuZGVuY2llczogW1wicmVhY3QtdXNlXCJdLFxuICAgICAgfSksXG4gICAgICByZW1peCh7XG4gICAgICAgIGZ1dHVyZToge1xuICAgICAgICAgIHYzX2ZldGNoZXJQZXJzaXN0OiB0cnVlLFxuICAgICAgICAgIHYzX3JlbGF0aXZlU3BsYXRQYXRoOiB0cnVlLFxuICAgICAgICAgIHYzX3Rocm93QWJvcnRSZWFzb246IHRydWUsXG4gICAgICAgICAgdjNfc2luZ2xlRmV0Y2g6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHNzcjogZmFsc2UsIC8vIFNQQSBNT0RFIC0gTWlnaHQgbWlncmF0ZSB0byBSZWFjdCBSb3V0ZXIgN1xuICAgICAgICByb3V0ZXMsXG4gICAgICB9KSxcbiAgICAgIHZpdGVTdGF0aWNDb3B5KHtcbiAgICAgICAgdGFyZ2V0czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogXCJhcHAvYXNzZXRzL3N2Z3MvYXBwLXNpZ25ldC5zdmdcIixcbiAgICAgICAgICAgIGRlc3Q6IFwiXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6IFwiYXBwL2xvY2FsZXMvZW4vdHJhbnNsYXRpb24uanNvblwiLFxuICAgICAgICAgICAgZGVzdDogXCJsb2NhbGVzL2VuXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6IFwiYXBwL2xvY2FsZXMvcGwvdHJhbnNsYXRpb24uanNvblwiLFxuICAgICAgICAgICAgZGVzdDogXCJsb2NhbGVzL3BsXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAuLi4ocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiXG4gICAgICAgICAgICA/IFtcbiAgICAgICAgICAgICAgICB7IHNyYzogXCJhcHAvYXNzZXRzL3N2Z3MvYXBwLWxvZ28uc3ZnXCIsIGRlc3Q6IFwiYXBwL2Fzc2V0cy9zdmdzXCIgfSxcbiAgICAgICAgICAgICAgICB7IHNyYzogXCJhcHAvYXNzZXRzL3N2Z3MvYXBwLWVtYWlsLWxvZ28uc3ZnXCIsIGRlc3Q6IFwiYXBwL2Fzc2V0cy9zdmdzXCIgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBzcmM6IFwiYXBwL2Fzc2V0cy9zdmdzL2FwcC1lbWFpbC1ib3JkZXItY2lyY2xlLnN2Z1wiLFxuICAgICAgICAgICAgICAgICAgZGVzdDogXCJhcHAvYXNzZXRzL3N2Z3NcIixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICA6IFtdKSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgICAgdHNjb25maWdQYXRocygpLFxuICAgICAgc2VudHJ5Vml0ZVBsdWdpbih7XG4gICAgICAgIG9yZzogZW52LlNFTlRSWV9PUkcsXG4gICAgICAgIHByb2plY3Q6IGVudi5TRU5UUllfUFJPSkVDVCxcbiAgICAgICAgYXV0aFRva2VuOiBlbnYuU0VOVFJZX0FVVEhfVE9LRU4sXG4gICAgICAgIHNvdXJjZW1hcHM6IHtcbiAgICAgICAgICBhc3NldHM6IFwiLi9idWlsZC9jbGllbnQvKipcIixcbiAgICAgICAgfSxcbiAgICAgICAgdGVsZW1ldHJ5OiBmYWxzZSxcbiAgICAgIH0pLFxuICAgIF0sXG4gICAgc3NyOiB7XG4gICAgICBub0V4dGVybmFsOiBbXCJwb3N0aG9nLWpzXCIsIFwicG9zdGhvZy1qcy9yZWFjdFwiLCBcInJlYWN0LWVhc3ktY3JvcFwiXSxcbiAgICB9LFxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9yZW1peC1ydW4vcmVtaXgvaXNzdWVzLzEwMTU2XG4gICAgc2VydmVyOiB7XG4gICAgICB3YXJtdXA6IHtcbiAgICAgICAgY2xpZW50RmlsZXM6IFtcIi4vYXBwLyoqLyoudHN4XCJdLFxuICAgICAgfSxcbiAgICAgIHByb3h5OiB7XG4gICAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICBcIn4vXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9hcHBcIiksXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogXCJidWlsZFwiLFxuICAgICAgc291cmNlbWFwOiB0cnVlLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBleHRlcm5hbDogW1wiZnNldmVudHNcIl0sXG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJAcmVtaXgtcnVuXCIpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBcInJlbWl4XCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBjb21tb25qc09wdGlvbnM6IHtcbiAgICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWUsXG4gICAgICAgIGluY2x1ZGU6IFsvbm9kZV9tb2R1bGVzXFwvcG9zdGhvZy1qcy8sIC9ub2RlX21vZHVsZXNcXC9wb3N0aG9nLWpzXFwvcmVhY3QvLCAvbm9kZV9tb2R1bGVzL10sXG4gICAgICB9LFxuICAgIH0sXG4gICAgb3B0aW1pemVEZXBzOiB7XG4gICAgICBpbmNsdWRlOiBbXCJAcmVtaXgtcnVuL3JlYWN0XCIsIFwiY3J5cHRvLWpzXCIsIFwicG9zdGhvZy1qc1wiLCBcInBvc3Rob2ctanMvcmVhY3RcIl0sXG4gICAgICBleGNsdWRlOiBbXCJmc2V2ZW50c1wiXSxcbiAgICB9LFxuICB9O1xufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9ob21lL3VzZXIvbWVudGluZ29GaW5hbC9tZW50aW5nby9hcHBzL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvdXNlci9tZW50aW5nb0ZpbmFsL21lbnRpbmdvL2FwcHMvd2ViL3JvdXRlcy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS91c2VyL21lbnRpbmdvRmluYWwvbWVudGluZ28vYXBwcy93ZWIvcm91dGVzLnRzXCI7aW1wb3J0IHR5cGUgeyBEZWZpbmVSb3V0ZUZ1bmN0aW9uLCBSb3V0ZU1hbmlmZXN0IH0gZnJvbSBcIkByZW1peC1ydW4vZGV2L2Rpc3QvY29uZmlnL3JvdXRlc1wiO1xuXG5leHBvcnQgY29uc3Qgcm91dGVzOiAoXG4gIGRlZmluZVJvdXRlczogKGNhbGxiYWNrOiAoZGVmaW5lUm91dGU6IERlZmluZVJvdXRlRnVuY3Rpb24pID0+IHZvaWQpID0+IFJvdXRlTWFuaWZlc3QsXG4pID0+IFJvdXRlTWFuaWZlc3QgfCBQcm9taXNlPFJvdXRlTWFuaWZlc3Q+ID0gKGRlZmluZVJvdXRlcykgPT4ge1xuICByZXR1cm4gZGVmaW5lUm91dGVzKChyb3V0ZSkgPT4ge1xuICAgIHJvdXRlKFwiXCIsIFwibW9kdWxlcy9sYXlvdXQudHN4XCIsICgpID0+IHtcbiAgICAgIHJvdXRlKFwiYXV0aFwiLCBcIm1vZHVsZXMvQXV0aC9BdXRoLmxheW91dC50c3hcIiwgKCkgPT4ge1xuICAgICAgICByb3V0ZShcImxvZ2luXCIsIFwibW9kdWxlcy9BdXRoL0xvZ2luLnBhZ2UudHN4XCIsIHsgaW5kZXg6IHRydWUgfSk7XG4gICAgICAgIHJvdXRlKFwicmVnaXN0ZXJcIiwgXCJtb2R1bGVzL0F1dGgvUmVnaXN0ZXIucGFnZS50c3hcIik7XG4gICAgICAgIHJvdXRlKFwiY3JlYXRlLW5ldy1wYXNzd29yZFwiLCBcIm1vZHVsZXMvQXV0aC9DcmVhdGVOZXdQYXNzd29yZC5wYWdlLnRzeFwiKTtcbiAgICAgICAgcm91dGUoXCJwYXNzd29yZC1yZWNvdmVyeVwiLCBcIm1vZHVsZXMvQXV0aC9QYXNzd29yZFJlY292ZXJ5LnBhZ2UudHN4XCIpO1xuICAgICAgICByb3V0ZShcIm1hZ2ljLWxpbmtcIiwgXCJtb2R1bGVzL0F1dGgvTWFnaWNMaW5rLnBhZ2UudHN4XCIpO1xuICAgICAgICByb3V0ZShcIm1mYVwiLCBcIm1vZHVsZXMvQXV0aC9NRkEucGFnZS50c3hcIik7XG4gICAgICB9KTtcbiAgICAgIHJvdXRlKFwidGVuYW50LWluYWN0aXZlXCIsIFwibW9kdWxlcy9FcnJvcnMvVGVuYW50SW5hY3RpdmUucGFnZS50c3hcIik7XG4gICAgICByb3V0ZShcIlwiLCBcIm1vZHVsZXMvTmF2aWdhdGlvbi9OYXZpZ2F0aW9uV3JhcHBlci50c3hcIiwgKCkgPT4ge1xuICAgICAgICByb3V0ZShcIlwiLCBcIm1vZHVsZXMvRGFzaGJvYXJkL1B1YmxpY0Rhc2hib2FyZC5sYXlvdXQudHN4XCIsICgpID0+IHtcbiAgICAgICAgICByb3V0ZShcImNvdXJzZXNcIiwgXCJtb2R1bGVzL0NvdXJzZXMvQ291cnNlcy5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImNvdXJzZS86aWRcIiwgXCJtb2R1bGVzL0NvdXJzZXMvQ291cnNlVmlldy9Db3Vyc2VWaWV3LnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFwiZGV2ZWxvcG1lbnQtcGF0aHNcIiwgXCJtb2R1bGVzL0xlYXJuaW5nUGF0aHMvTGVhcm5pbmdQYXRocy5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImNhbGVuZGFyXCIsIFwibW9kdWxlcy9DYWxlbmRhci9DYWxlbmRhci5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImxpdmUtdHJhaW5pbmcvOmlkL3Jvb21cIiwgXCJtb2R1bGVzL0xpdmVUcmFpbmluZy9MaXZlVHJhaW5pbmcucGFnZS50c3hcIiwge1xuICAgICAgICAgICAgaWQ6IFwibGl2ZS10cmFpbmluZy1yb29tXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcm91dGUoXCJsaXZlLXRyYWluaW5nLzppZFwiLCBcIm1vZHVsZXMvTGl2ZVRyYWluaW5nL0xpdmVUcmFpbmluZy5wYWdlLnRzeFwiLCB7XG4gICAgICAgICAgICBpZDogXCJsaXZlLXRyYWluaW5nLWRldGFpbHNcIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByb3V0ZShcInFhXCIsIFwibW9kdWxlcy9RQS9RQS5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcInFhL25ld1wiLCBcIm1vZHVsZXMvUUEvQ3JlYXRlUUEucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJxYS86aWRcIiwgXCJtb2R1bGVzL1FBL0VkaXRRQS5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImFydGljbGVzXCIsIFwibW9kdWxlcy9BcnRpY2xlcy9BcnRpY2xlcy5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImFydGljbGVzLzphcnRpY2xlSWRcIiwgXCJtb2R1bGVzL0FydGljbGVzL0FydGljbGVEZXRhaWxzLnBhZ2UudHN4XCIsIHtcbiAgICAgICAgICAgIGlkOiBcImFydGljbGUtZGV0YWlsc1wiLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJvdXRlKFwibmV3cy86bmV3c0lkL2VkaXRcIiwgXCJtb2R1bGVzL05ld3MvTmV3c0Zvcm0ucGFnZS50c3hcIiwge1xuICAgICAgICAgICAgaWQ6IFwiZWRpdC1uZXdzXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcm91dGUoXCJuZXdzL2FkZFwiLCBcIm1vZHVsZXMvTmV3cy9OZXdzRm9ybS5wYWdlLnRzeFwiLCB7XG4gICAgICAgICAgICBpZDogXCJhZGQtbmV3c1wiLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJvdXRlKFwibmV3c1wiLCBcIm1vZHVsZXMvTmV3cy9OZXdzLnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFwibmV3cy86bmV3c0lkXCIsIFwibW9kdWxlcy9OZXdzL05ld3NEZXRhaWxzLnBhZ2UudHN4XCIsIHtcbiAgICAgICAgICAgIGlkOiBcIm5ld3MtZGV0YWlsc1wiLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcm91dGUoXCJcIiwgXCJtb2R1bGVzL0Rhc2hib2FyZC9Vc2VyRGFzaGJvYXJkLmxheW91dC50c3hcIiwgKCkgPT4ge1xuICAgICAgICAgIHJvdXRlKFwiXCIsIFwibW9kdWxlcy9EYXNoYm9hcmQvSW5kZXhSZWRpcmVjdC5wYWdlLnRzeFwiLCB7IGluZGV4OiB0cnVlIH0pO1xuICAgICAgICAgIHJvdXRlKFwicHJvZ3Jlc3NcIiwgXCJtb2R1bGVzL1N0YXRpc3RpY3MvU3RhdGlzdGljcy5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcIm5vdGlmaWNhdGlvbnNcIiwgXCJtb2R1bGVzL05vdGlmaWNhdGlvbnMvTm90aWZpY2F0aW9ucy5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcInNldHRpbmdzXCIsIFwibW9kdWxlcy9EYXNoYm9hcmQvU2V0dGluZ3MvU2V0dGluZ3MucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJwcm92aWRlci1pbmZvcm1hdGlvblwiLCBcIm1vZHVsZXMvUHJvdmlkZXJJbmZvcm1hdGlvbi9Qcm92aWRlckluZm9ybWF0aW9uLnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFwiYXJ0aWNsZXMvOmFydGljbGVJZC9lZGl0XCIsIFwibW9kdWxlcy9BcnRpY2xlcy9BcnRpY2xlRm9ybS5wYWdlLnRzeFwiLCB7XG4gICAgICAgICAgICBpZDogXCJlZGl0LWFydGljbGVcIixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByb3V0ZShcInByb2ZpbGUvOmlkXCIsIFwibW9kdWxlcy9Qcm9maWxlL1Byb2ZpbGUucGFnZS50c3hcIik7XG4gICAgICAgIH0pO1xuICAgICAgICByb3V0ZShcImNvdXJzZS86Y291cnNlSWQvbGVzc29uXCIsIFwibW9kdWxlcy9Db3Vyc2VzL0xlc3Nvbi9MZXNzb24ubGF5b3V0LnRzeFwiLCAoKSA9PiB7XG4gICAgICAgICAgcm91dGUoXCI6bGVzc29uSWRcIiwgXCJtb2R1bGVzL0NvdXJzZXMvTGVzc29uL0xlc3Nvbi5wYWdlLnRzeFwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJvdXRlKFwiYWRtaW5cIiwgXCJtb2R1bGVzL0FkbWluL0FkbWluLmxheW91dC50c3hcIiwgKCkgPT4ge1xuICAgICAgICAgIHJvdXRlKFwiY291cnNlc1wiLCBcIm1vZHVsZXMvQWRtaW4vQ291cnNlcy9Db3Vyc2VzLnBhZ2UudHN4XCIsIHtcbiAgICAgICAgICAgIGluZGV4OiB0cnVlLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJvdXRlKFwiYW5hbHl0aWNzXCIsIFwibW9kdWxlcy9TdGF0aXN0aWNzL0FuYWx5dGljcy5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImVudnNcIiwgXCJtb2R1bGVzL0FkbWluL0VudnMvRW52cy5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImJldGEtY291cnNlcy9uZXdcIiwgXCJtb2R1bGVzL0FkbWluL0FkZENvdXJzZS9Db3Vyc2VUeXBlU2VsZWN0b3IucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJiZXRhLWNvdXJzZXMvbmV3L3N0YW5kYXJkXCIsIFwibW9kdWxlcy9BZG1pbi9BZGRDb3Vyc2UvQWRkQ291cnNlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImNvdXJzZXMvbmV3LXNjb3JtXCIsIFwibW9kdWxlcy9BZG1pbi9TY29ybS9DcmVhdGVOZXdTY29ybUNvdXJzZS5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImJldGEtY291cnNlcy86aWRcIiwgXCJtb2R1bGVzL0FkbWluL0VkaXRDb3Vyc2UvRWRpdENvdXJzZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJ1c2Vyc1wiLCBcIm1vZHVsZXMvQWRtaW4vVXNlcnMvVXNlcnMucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJ1c2Vycy86aWRcIiwgXCJtb2R1bGVzL0FkbWluL1VzZXJzL1VzZXIucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJ1c2Vycy9uZXdcIiwgXCJtb2R1bGVzL0FkbWluL1VzZXJzL0NyZWF0ZU5ld1VzZXIucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJjYXRlZ29yaWVzXCIsIFwibW9kdWxlcy9BZG1pbi9DYXRlZ29yaWVzL0NhdGVnb3JpZXMucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJjYXRlZ29yaWVzLzppZFwiLCBcIm1vZHVsZXMvQWRtaW4vQ2F0ZWdvcmllcy9DYXRlZ29yeS5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcImNhdGVnb3JpZXMvbmV3XCIsIFwibW9kdWxlcy9BZG1pbi9DYXRlZ29yaWVzL0NyZWF0ZU5ld0NhdGVnb3J5LnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFwiZ3JvdXBzXCIsIFwibW9kdWxlcy9BZG1pbi9Hcm91cHMvR3JvdXBzLnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFwiZ3JvdXBzL25ld1wiLCBcIm1vZHVsZXMvQWRtaW4vR3JvdXBzL0NyZWF0ZUdyb3VwLnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFwiZ3JvdXBzLzppZFwiLCBcIm1vZHVsZXMvQWRtaW4vR3JvdXBzL0VkaXRHcm91cC5wYWdlLnRzeFwiKTtcbiAgICAgICAgICByb3V0ZShcInByb21vdGlvbi1jb2Rlc1wiLCBcIm1vZHVsZXMvQWRtaW4vUHJvbW90aW9uQ29kZXMvUHJvbW90aW9uQ29kZXMucGFnZS50c3hcIik7XG4gICAgICAgICAgcm91dGUoXCJwcm9tb3Rpb24tY29kZXMvbmV3XCIsIFwibW9kdWxlcy9BZG1pbi9Qcm9tb3Rpb25Db2Rlcy9DcmVhdGVQcm9tb3Rpb25Db2RlLnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFxuICAgICAgICAgICAgXCJwcm9tb3Rpb24tY29kZXMvOmlkXCIsXG4gICAgICAgICAgICBcIm1vZHVsZXMvQWRtaW4vUHJvbW90aW9uQ29kZXMvUHJvbW90aW9uQ29kZURldGFpbHMucGFnZS50c3hcIixcbiAgICAgICAgICApO1xuICAgICAgICAgIHJvdXRlKFwiYWN0aXZpdHktbG9nc1wiLCBcIm1vZHVsZXMvQWN0aXZpdHlMb2dzL0FjdGl2aXR5TG9ncy5wYWdlLnRzeFwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJvdXRlKFwic3VwZXItYWRtaW5cIiwgXCJtb2R1bGVzL1N1cGVyQWRtaW4vU3VwZXJBZG1pbi5sYXlvdXQudHN4XCIsICgpID0+IHtcbiAgICAgICAgICByb3V0ZShcInRlbmFudHNcIiwgXCJtb2R1bGVzL1N1cGVyQWRtaW4vVGVuYW50cy5wYWdlLnRzeFwiLCB7IGluZGV4OiB0cnVlIH0pO1xuICAgICAgICAgIHJvdXRlKFwidGVuYW50cy9uZXdcIiwgXCJtb2R1bGVzL1N1cGVyQWRtaW4vQ3JlYXRlVGVuYW50LnBhZ2UudHN4XCIpO1xuICAgICAgICAgIHJvdXRlKFwidGVuYW50cy86aWRcIiwgXCJtb2R1bGVzL1N1cGVyQWRtaW4vRWRpdFRlbmFudC5wYWdlLnRzeFwiKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVCxPQUFPLFVBQVU7QUFFalUsU0FBUyxjQUFjLGFBQWE7QUFDcEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxjQUFjLGVBQWU7QUFDdEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxzQkFBc0I7QUFDL0IsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sbUJBQW1COzs7QUNObkIsSUFBTSxTQUVpQyxDQUFDLGlCQUFpQjtBQUM5RCxTQUFPLGFB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
