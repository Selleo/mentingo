// vite.config.ts
import path from "path";
import { vitePlugin as remix } from "file:///C:/Users/Patryk/ArbeitMachtFrei/mentingo/node_modules/.pnpm/@remix-run+dev@2.15.0_@remi_5a2604a42105a534fb46ec3e7289aa1b/node_modules/@remix-run/dev/dist/index.js";
import { sentryVitePlugin } from "file:///C:/Users/Patryk/ArbeitMachtFrei/mentingo/node_modules/.pnpm/@sentry+vite-plugin@2.22.6/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import { defineConfig, loadEnv } from "file:///C:/Users/Patryk/ArbeitMachtFrei/mentingo/node_modules/.pnpm/vite@5.4.11_@types+node@20.17.6_terser@5.36.0/node_modules/vite/dist/node/index.js";
import { cjsInterop } from "file:///C:/Users/Patryk/ArbeitMachtFrei/mentingo/node_modules/.pnpm/vite-plugin-cjs-interop@2.1.4/node_modules/vite-plugin-cjs-interop/dist/index.js";
import { viteStaticCopy } from "file:///C:/Users/Patryk/ArbeitMachtFrei/mentingo/node_modules/.pnpm/vite-plugin-static-copy@1.0_8fc038b178de5927e1790a550b3bb488/node_modules/vite-plugin-static-copy/dist/index.js";
import svgr from "file:///C:/Users/Patryk/ArbeitMachtFrei/mentingo/node_modules/.pnpm/vite-plugin-svgr@4.2.0_roll_63f1392d9d22dc09575b70e19c3b2698/node_modules/vite-plugin-svgr/dist/index.js";
import tsconfigPaths from "file:///C:/Users/Patryk/ArbeitMachtFrei/mentingo/node_modules/.pnpm/vite-tsconfig-paths@5.0.0_t_3257f5b5970ae0f07b249c8848ff49e7/node_modules/vite-tsconfig-paths/dist/index.js";

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
var __vite_injected_original_dirname = "C:\\Users\\Patryk\\ArbeitMachtFrei\\mentingo\\apps\\web";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicm91dGVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUGF0cnlrXFxcXEFyYmVpdE1hY2h0RnJlaVxcXFxtZW50aW5nb1xcXFxhcHBzXFxcXHdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUGF0cnlrXFxcXEFyYmVpdE1hY2h0RnJlaVxcXFxtZW50aW5nb1xcXFxhcHBzXFxcXHdlYlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvUGF0cnlrL0FyYmVpdE1hY2h0RnJlaS9tZW50aW5nby9hcHBzL3dlYi92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG5pbXBvcnQgeyB2aXRlUGx1Z2luIGFzIHJlbWl4IH0gZnJvbSBcIkByZW1peC1ydW4vZGV2XCI7XHJcbmltcG9ydCB7IHNlbnRyeVZpdGVQbHVnaW4gfSBmcm9tIFwiQHNlbnRyeS92aXRlLXBsdWdpblwiO1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgeyBjanNJbnRlcm9wIH0gZnJvbSBcInZpdGUtcGx1Z2luLWNqcy1pbnRlcm9wXCI7XHJcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSBcInZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5XCI7XHJcbmltcG9ydCBzdmdyIGZyb20gXCJ2aXRlLXBsdWdpbi1zdmdyXCI7XHJcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gXCJ2aXRlLXRzY29uZmlnLXBhdGhzXCI7XHJcblxyXG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tIFwiLi9yb3V0ZXNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICBzdmdyKCksXHJcbiAgICAgIGNqc0ludGVyb3Aoe1xyXG4gICAgICAgIGRlcGVuZGVuY2llczogW1wicmVhY3QtdXNlXCJdLFxyXG4gICAgICB9KSxcclxuICAgICAgcmVtaXgoe1xyXG4gICAgICAgIGZ1dHVyZToge1xyXG4gICAgICAgICAgdjNfZmV0Y2hlclBlcnNpc3Q6IHRydWUsXHJcbiAgICAgICAgICB2M19yZWxhdGl2ZVNwbGF0UGF0aDogdHJ1ZSxcclxuICAgICAgICAgIHYzX3Rocm93QWJvcnRSZWFzb246IHRydWUsXHJcbiAgICAgICAgICB2M19zaW5nbGVGZXRjaDogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNzcjogZmFsc2UsIC8vIFNQQSBNT0RFIC0gTWlnaHQgbWlncmF0ZSB0byBSZWFjdCBSb3V0ZXIgN1xyXG4gICAgICAgIHJvdXRlcyxcclxuICAgICAgfSksXHJcbiAgICAgIHZpdGVTdGF0aWNDb3B5KHtcclxuICAgICAgICB0YXJnZXRzOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogXCJhcHAvYXNzZXRzL3N2Z3MvYXBwLXNpZ25ldC5zdmdcIixcclxuICAgICAgICAgICAgZGVzdDogXCJcIixcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogXCJhcHAvbG9jYWxlcy9lbi90cmFuc2xhdGlvbi5qc29uXCIsXHJcbiAgICAgICAgICAgIGRlc3Q6IFwibG9jYWxlcy9lblwiLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiBcImFwcC9sb2NhbGVzL3BsL3RyYW5zbGF0aW9uLmpzb25cIixcclxuICAgICAgICAgICAgZGVzdDogXCJsb2NhbGVzL3BsXCIsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgLi4uKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInByb2R1Y3Rpb25cIlxyXG4gICAgICAgICAgICA/IFtcclxuICAgICAgICAgICAgICAgIHsgc3JjOiBcImFwcC9hc3NldHMvc3Zncy9hcHAtbG9nby5zdmdcIiwgZGVzdDogXCJhcHAvYXNzZXRzL3N2Z3NcIiB9LFxyXG4gICAgICAgICAgICAgICAgeyBzcmM6IFwiYXBwL2Fzc2V0cy9zdmdzL2FwcC1lbWFpbC1sb2dvLnN2Z1wiLCBkZXN0OiBcImFwcC9hc3NldHMvc3Znc1wiIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIHNyYzogXCJhcHAvYXNzZXRzL3N2Z3MvYXBwLWVtYWlsLWJvcmRlci1jaXJjbGUuc3ZnXCIsXHJcbiAgICAgICAgICAgICAgICAgIGRlc3Q6IFwiYXBwL2Fzc2V0cy9zdmdzXCIsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgOiBbXSksXHJcbiAgICAgICAgXSxcclxuICAgICAgfSksXHJcbiAgICAgIHRzY29uZmlnUGF0aHMoKSxcclxuICAgICAgc2VudHJ5Vml0ZVBsdWdpbih7XHJcbiAgICAgICAgb3JnOiBlbnYuU0VOVFJZX09SRyxcclxuICAgICAgICBwcm9qZWN0OiBlbnYuU0VOVFJZX1BST0pFQ1QsXHJcbiAgICAgICAgYXV0aFRva2VuOiBlbnYuU0VOVFJZX0FVVEhfVE9LRU4sXHJcbiAgICAgICAgc291cmNlbWFwczoge1xyXG4gICAgICAgICAgYXNzZXRzOiBcIi4vYnVpbGQvY2xpZW50LyoqXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgICB0ZWxlbWV0cnk6IGZhbHNlLFxyXG4gICAgICB9KSxcclxuICAgIF0sXHJcbiAgICBzc3I6IHtcclxuICAgICAgbm9FeHRlcm5hbDogW1wicG9zdGhvZy1qc1wiLCBcInBvc3Rob2ctanMvcmVhY3RcIiwgXCJyZWFjdC1lYXN5LWNyb3BcIl0sXHJcbiAgICB9LFxyXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3JlbWl4LXJ1bi9yZW1peC9pc3N1ZXMvMTAxNTZcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICB3YXJtdXA6IHtcclxuICAgICAgICBjbGllbnRGaWxlczogW1wiLi9hcHAvKiovKi50c3hcIl0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHByb3h5OiB7XHJcbiAgICAgICAgXCIvYXBpXCI6IHtcclxuICAgICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIHdzOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwifi9cIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL2FwcFwiKSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBvdXREaXI6IFwiYnVpbGRcIixcclxuICAgICAgc291cmNlbWFwOiB0cnVlLFxyXG4gICAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgICAgZXh0ZXJuYWw6IFtcImZzZXZlbnRzXCJdLFxyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IHtcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQHJlbWl4LXJ1blwiKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiBcInJlbWl4XCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgY29tbW9uanNPcHRpb25zOiB7XHJcbiAgICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWUsXHJcbiAgICAgICAgaW5jbHVkZTogWy9ub2RlX21vZHVsZXNcXC9wb3N0aG9nLWpzLywgL25vZGVfbW9kdWxlc1xcL3Bvc3Rob2ctanNcXC9yZWFjdC8sIC9ub2RlX21vZHVsZXMvXSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBvcHRpbWl6ZURlcHM6IHtcclxuICAgICAgaW5jbHVkZTogW1wiQHJlbWl4LXJ1bi9yZWFjdFwiLCBcImNyeXB0by1qc1wiLCBcInBvc3Rob2ctanNcIiwgXCJwb3N0aG9nLWpzL3JlYWN0XCJdLFxyXG4gICAgICBleGNsdWRlOiBbXCJmc2V2ZW50c1wiXSxcclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUGF0cnlrXFxcXEFyYmVpdE1hY2h0RnJlaVxcXFxtZW50aW5nb1xcXFxhcHBzXFxcXHdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUGF0cnlrXFxcXEFyYmVpdE1hY2h0RnJlaVxcXFxtZW50aW5nb1xcXFxhcHBzXFxcXHdlYlxcXFxyb3V0ZXMudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1BhdHJ5ay9BcmJlaXRNYWNodEZyZWkvbWVudGluZ28vYXBwcy93ZWIvcm91dGVzLnRzXCI7aW1wb3J0IHR5cGUgeyBEZWZpbmVSb3V0ZUZ1bmN0aW9uLCBSb3V0ZU1hbmlmZXN0IH0gZnJvbSBcIkByZW1peC1ydW4vZGV2L2Rpc3QvY29uZmlnL3JvdXRlc1wiO1xyXG5cclxuZXhwb3J0IGNvbnN0IHJvdXRlczogKFxyXG4gIGRlZmluZVJvdXRlczogKGNhbGxiYWNrOiAoZGVmaW5lUm91dGU6IERlZmluZVJvdXRlRnVuY3Rpb24pID0+IHZvaWQpID0+IFJvdXRlTWFuaWZlc3QsXHJcbikgPT4gUm91dGVNYW5pZmVzdCB8IFByb21pc2U8Um91dGVNYW5pZmVzdD4gPSAoZGVmaW5lUm91dGVzKSA9PiB7XHJcbiAgcmV0dXJuIGRlZmluZVJvdXRlcygocm91dGUpID0+IHtcclxuICAgIHJvdXRlKFwiXCIsIFwibW9kdWxlcy9sYXlvdXQudHN4XCIsICgpID0+IHtcclxuICAgICAgcm91dGUoXCJhdXRoXCIsIFwibW9kdWxlcy9BdXRoL0F1dGgubGF5b3V0LnRzeFwiLCAoKSA9PiB7XHJcbiAgICAgICAgcm91dGUoXCJsb2dpblwiLCBcIm1vZHVsZXMvQXV0aC9Mb2dpbi5wYWdlLnRzeFwiLCB7IGluZGV4OiB0cnVlIH0pO1xyXG4gICAgICAgIHJvdXRlKFwicmVnaXN0ZXJcIiwgXCJtb2R1bGVzL0F1dGgvUmVnaXN0ZXIucGFnZS50c3hcIik7XHJcbiAgICAgICAgcm91dGUoXCJjcmVhdGUtbmV3LXBhc3N3b3JkXCIsIFwibW9kdWxlcy9BdXRoL0NyZWF0ZU5ld1Bhc3N3b3JkLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgIHJvdXRlKFwicGFzc3dvcmQtcmVjb3ZlcnlcIiwgXCJtb2R1bGVzL0F1dGgvUGFzc3dvcmRSZWNvdmVyeS5wYWdlLnRzeFwiKTtcclxuICAgICAgICByb3V0ZShcIm1hZ2ljLWxpbmtcIiwgXCJtb2R1bGVzL0F1dGgvTWFnaWNMaW5rLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgIHJvdXRlKFwibWZhXCIsIFwibW9kdWxlcy9BdXRoL01GQS5wYWdlLnRzeFwiKTtcclxuICAgICAgfSk7XHJcbiAgICAgIHJvdXRlKFwidGVuYW50LWluYWN0aXZlXCIsIFwibW9kdWxlcy9FcnJvcnMvVGVuYW50SW5hY3RpdmUucGFnZS50c3hcIik7XHJcbiAgICAgIHJvdXRlKFwiXCIsIFwibW9kdWxlcy9OYXZpZ2F0aW9uL05hdmlnYXRpb25XcmFwcGVyLnRzeFwiLCAoKSA9PiB7XHJcbiAgICAgICAgcm91dGUoXCJcIiwgXCJtb2R1bGVzL0Rhc2hib2FyZC9QdWJsaWNEYXNoYm9hcmQubGF5b3V0LnRzeFwiLCAoKSA9PiB7XHJcbiAgICAgICAgICByb3V0ZShcImNvdXJzZXNcIiwgXCJtb2R1bGVzL0NvdXJzZXMvQ291cnNlcy5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwiY291cnNlLzppZFwiLCBcIm1vZHVsZXMvQ291cnNlcy9Db3Vyc2VWaWV3L0NvdXJzZVZpZXcucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImRldmVsb3BtZW50LXBhdGhzXCIsIFwibW9kdWxlcy9MZWFybmluZ1BhdGhzL0xlYXJuaW5nUGF0aHMucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImNhbGVuZGFyXCIsIFwibW9kdWxlcy9DYWxlbmRhci9DYWxlbmRhci5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwibGl2ZS10cmFpbmluZy86aWQvcm9vbVwiLCBcIm1vZHVsZXMvTGl2ZVRyYWluaW5nL0xpdmVUcmFpbmluZy5wYWdlLnRzeFwiLCB7XHJcbiAgICAgICAgICAgIGlkOiBcImxpdmUtdHJhaW5pbmctcm9vbVwiLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByb3V0ZShcImxpdmUtdHJhaW5pbmcvOmlkXCIsIFwibW9kdWxlcy9MaXZlVHJhaW5pbmcvTGl2ZVRyYWluaW5nLnBhZ2UudHN4XCIsIHtcclxuICAgICAgICAgICAgaWQ6IFwibGl2ZS10cmFpbmluZy1kZXRhaWxzXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHJvdXRlKFwicWFcIiwgXCJtb2R1bGVzL1FBL1FBLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJxYS9uZXdcIiwgXCJtb2R1bGVzL1FBL0NyZWF0ZVFBLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJxYS86aWRcIiwgXCJtb2R1bGVzL1FBL0VkaXRRQS5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwiYXJ0aWNsZXNcIiwgXCJtb2R1bGVzL0FydGljbGVzL0FydGljbGVzLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJhcnRpY2xlcy86YXJ0aWNsZUlkXCIsIFwibW9kdWxlcy9BcnRpY2xlcy9BcnRpY2xlRGV0YWlscy5wYWdlLnRzeFwiLCB7XHJcbiAgICAgICAgICAgIGlkOiBcImFydGljbGUtZGV0YWlsc1wiLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByb3V0ZShcIm5ld3MvOm5ld3NJZC9lZGl0XCIsIFwibW9kdWxlcy9OZXdzL05ld3NGb3JtLnBhZ2UudHN4XCIsIHtcclxuICAgICAgICAgICAgaWQ6IFwiZWRpdC1uZXdzXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHJvdXRlKFwibmV3cy9hZGRcIiwgXCJtb2R1bGVzL05ld3MvTmV3c0Zvcm0ucGFnZS50c3hcIiwge1xyXG4gICAgICAgICAgICBpZDogXCJhZGQtbmV3c1wiLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICByb3V0ZShcIm5ld3NcIiwgXCJtb2R1bGVzL05ld3MvTmV3cy5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwibmV3cy86bmV3c0lkXCIsIFwibW9kdWxlcy9OZXdzL05ld3NEZXRhaWxzLnBhZ2UudHN4XCIsIHtcclxuICAgICAgICAgICAgaWQ6IFwibmV3cy1kZXRhaWxzXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByb3V0ZShcIlwiLCBcIm1vZHVsZXMvRGFzaGJvYXJkL1VzZXJEYXNoYm9hcmQubGF5b3V0LnRzeFwiLCAoKSA9PiB7XHJcbiAgICAgICAgICByb3V0ZShcIlwiLCBcIm1vZHVsZXMvRGFzaGJvYXJkL0luZGV4UmVkaXJlY3QucGFnZS50c3hcIiwgeyBpbmRleDogdHJ1ZSB9KTtcclxuICAgICAgICAgIHJvdXRlKFwicHJvZ3Jlc3NcIiwgXCJtb2R1bGVzL1N0YXRpc3RpY3MvU3RhdGlzdGljcy5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwibm90aWZpY2F0aW9uc1wiLCBcIm1vZHVsZXMvTm90aWZpY2F0aW9ucy9Ob3RpZmljYXRpb25zLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJzZXR0aW5nc1wiLCBcIm1vZHVsZXMvRGFzaGJvYXJkL1NldHRpbmdzL1NldHRpbmdzLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJwcm92aWRlci1pbmZvcm1hdGlvblwiLCBcIm1vZHVsZXMvUHJvdmlkZXJJbmZvcm1hdGlvbi9Qcm92aWRlckluZm9ybWF0aW9uLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJhcnRpY2xlcy86YXJ0aWNsZUlkL2VkaXRcIiwgXCJtb2R1bGVzL0FydGljbGVzL0FydGljbGVGb3JtLnBhZ2UudHN4XCIsIHtcclxuICAgICAgICAgICAgaWQ6IFwiZWRpdC1hcnRpY2xlXCIsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHJvdXRlKFwicHJvZmlsZS86aWRcIiwgXCJtb2R1bGVzL1Byb2ZpbGUvUHJvZmlsZS5wYWdlLnRzeFwiKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByb3V0ZShcImNvdXJzZS86Y291cnNlSWQvbGVzc29uXCIsIFwibW9kdWxlcy9Db3Vyc2VzL0xlc3Nvbi9MZXNzb24ubGF5b3V0LnRzeFwiLCAoKSA9PiB7XHJcbiAgICAgICAgICByb3V0ZShcIjpsZXNzb25JZFwiLCBcIm1vZHVsZXMvQ291cnNlcy9MZXNzb24vTGVzc29uLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJvdXRlKFwiYWRtaW5cIiwgXCJtb2R1bGVzL0FkbWluL0FkbWluLmxheW91dC50c3hcIiwgKCkgPT4ge1xyXG4gICAgICAgICAgcm91dGUoXCJjb3Vyc2VzXCIsIFwibW9kdWxlcy9BZG1pbi9Db3Vyc2VzL0NvdXJzZXMucGFnZS50c3hcIiwge1xyXG4gICAgICAgICAgICBpbmRleDogdHJ1ZSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgcm91dGUoXCJhbmFseXRpY3NcIiwgXCJtb2R1bGVzL1N0YXRpc3RpY3MvQW5hbHl0aWNzLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJlbnZzXCIsIFwibW9kdWxlcy9BZG1pbi9FbnZzL0VudnMucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImJldGEtY291cnNlcy9uZXdcIiwgXCJtb2R1bGVzL0FkbWluL0FkZENvdXJzZS9Db3Vyc2VUeXBlU2VsZWN0b3IucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImJldGEtY291cnNlcy9uZXcvc3RhbmRhcmRcIiwgXCJtb2R1bGVzL0FkbWluL0FkZENvdXJzZS9BZGRDb3Vyc2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJjb3Vyc2VzL25ldy1zY29ybVwiLCBcIm1vZHVsZXMvQWRtaW4vU2Nvcm0vQ3JlYXRlTmV3U2Nvcm1Db3Vyc2UucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImJldGEtY291cnNlcy86aWRcIiwgXCJtb2R1bGVzL0FkbWluL0VkaXRDb3Vyc2UvRWRpdENvdXJzZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcInVzZXJzXCIsIFwibW9kdWxlcy9BZG1pbi9Vc2Vycy9Vc2Vycy5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwidXNlcnMvOmlkXCIsIFwibW9kdWxlcy9BZG1pbi9Vc2Vycy9Vc2VyLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJ1c2Vycy9uZXdcIiwgXCJtb2R1bGVzL0FkbWluL1VzZXJzL0NyZWF0ZU5ld1VzZXIucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImNhdGVnb3JpZXNcIiwgXCJtb2R1bGVzL0FkbWluL0NhdGVnb3JpZXMvQ2F0ZWdvcmllcy5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwiY2F0ZWdvcmllcy86aWRcIiwgXCJtb2R1bGVzL0FkbWluL0NhdGVnb3JpZXMvQ2F0ZWdvcnkucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImNhdGVnb3JpZXMvbmV3XCIsIFwibW9kdWxlcy9BZG1pbi9DYXRlZ29yaWVzL0NyZWF0ZU5ld0NhdGVnb3J5LnBhZ2UudHN4XCIpO1xyXG4gICAgICAgICAgcm91dGUoXCJncm91cHNcIiwgXCJtb2R1bGVzL0FkbWluL0dyb3Vwcy9Hcm91cHMucGFnZS50c3hcIik7XHJcbiAgICAgICAgICByb3V0ZShcImdyb3Vwcy9uZXdcIiwgXCJtb2R1bGVzL0FkbWluL0dyb3Vwcy9DcmVhdGVHcm91cC5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwiZ3JvdXBzLzppZFwiLCBcIm1vZHVsZXMvQWRtaW4vR3JvdXBzL0VkaXRHcm91cC5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwicHJvbW90aW9uLWNvZGVzXCIsIFwibW9kdWxlcy9BZG1pbi9Qcm9tb3Rpb25Db2Rlcy9Qcm9tb3Rpb25Db2Rlcy5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwicHJvbW90aW9uLWNvZGVzL25ld1wiLCBcIm1vZHVsZXMvQWRtaW4vUHJvbW90aW9uQ29kZXMvQ3JlYXRlUHJvbW90aW9uQ29kZS5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFxyXG4gICAgICAgICAgICBcInByb21vdGlvbi1jb2Rlcy86aWRcIixcclxuICAgICAgICAgICAgXCJtb2R1bGVzL0FkbWluL1Byb21vdGlvbkNvZGVzL1Byb21vdGlvbkNvZGVEZXRhaWxzLnBhZ2UudHN4XCIsXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgICAgcm91dGUoXCJhY3Rpdml0eS1sb2dzXCIsIFwibW9kdWxlcy9BY3Rpdml0eUxvZ3MvQWN0aXZpdHlMb2dzLnBhZ2UudHN4XCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJvdXRlKFwic3VwZXItYWRtaW5cIiwgXCJtb2R1bGVzL1N1cGVyQWRtaW4vU3VwZXJBZG1pbi5sYXlvdXQudHN4XCIsICgpID0+IHtcclxuICAgICAgICAgIHJvdXRlKFwidGVuYW50c1wiLCBcIm1vZHVsZXMvU3VwZXJBZG1pbi9UZW5hbnRzLnBhZ2UudHN4XCIsIHsgaW5kZXg6IHRydWUgfSk7XHJcbiAgICAgICAgICByb3V0ZShcInRlbmFudHMvbmV3XCIsIFwibW9kdWxlcy9TdXBlckFkbWluL0NyZWF0ZVRlbmFudC5wYWdlLnRzeFwiKTtcclxuICAgICAgICAgIHJvdXRlKFwidGVuYW50cy86aWRcIiwgXCJtb2R1bGVzL1N1cGVyQWRtaW4vRWRpdFRlbmFudC5wYWdlLnRzeFwiKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxufTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFtVixPQUFPLFVBQVU7QUFFcFcsU0FBUyxjQUFjLGFBQWE7QUFDcEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxjQUFjLGVBQWU7QUFDdEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxzQkFBc0I7QUFDL0IsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sbUJBQW1COzs7QUNObkIsSUFBTSxTQUVpQyxDQUFDLGlCQUFpQjtBQUM5RCxTQUFPLGFBQWEsQ0FBQyxVQUFVO0FBQzdCLFVBQU0sSUFBSSxzQkFBc0IsTUFBTTtBQUNwQyxZQUFNLFFBQVEsZ0NBQWdDLE1BQU07QUFDbEQsY0FBTSxTQUFTLCtCQUErQixFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQzdELGNBQU0sWUFBWSxnQ0FBZ0M7QUFDbEQsY0FBTSx1QkFBdUIseUNBQXlDO0FBQ3RFLGNBQU0scUJBQXFCLHdDQUF3QztBQUNuRSxjQUFNLGNBQWMsaUNBQWlDO0FBQ3JELGNBQU0sT0FBTywyQkFBMkI7QUFBQSxNQUMxQyxDQUFDO0FBQ0QsWUFBTSxtQkFBbUIsd0NBQXdDO0FBQ2pFLFlBQU0sSUFBSSw0Q0FBNEMsTUFBTTtBQUMxRCxjQUFNLElBQUksZ0RBQWdELE1BQU07QUFDOUQsZ0JBQU0sV0FBVyxrQ0FBa0M7QUFDbkQsZ0JB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
