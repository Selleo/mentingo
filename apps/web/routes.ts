import type { DefineRouteFunction, RouteManifest } from "@remix-run/dev/dist/config/routes";

export const routes: (
  defineRoutes: (callback: (defineRoute: DefineRouteFunction) => void) => RouteManifest,
) => RouteManifest | Promise<RouteManifest> = (defineRoutes) => {
  return defineRoutes((route) => {
    route("", "modules/layout.tsx", () => {
      route("auth", "modules/Auth/Auth.layout.tsx", () => {
        route("login", "modules/Auth/Login.page.tsx", { index: true });
        route("register", "modules/Auth/Register.page.tsx");
        route("create-new-password", "modules/Auth/CreateNewPassword.page.tsx");
        route("password-recovery", "modules/Auth/PasswordRecovery.page.tsx");
        route("mfa", "modules/Auth/MFA.page.tsx");
      });
      route("", "modules/Navigation/NavigationWrapper.tsx", () => {
        route("", "modules/Dashboard/PublicDashboard.layout.tsx", () => {
          route("courses", "modules/Courses/Courses.page.tsx");
          route("course/:id", "modules/Courses/CourseView/CourseView.page.tsx");
          route("qa", "modules/QA/QA.page.tsx");
          route("qa/new", "modules/QA/CreateQA.page.tsx");
          route("qa/:id", "modules/QA/EditQA.page.tsx");
        });
        route("", "modules/Dashboard/UserDashboard.layout.tsx", () => {
          route("", "modules/Statistics/Statistics.page.tsx", {
            index: true,
          });
          route("settings", "modules/Dashboard/Settings/Settings.page.tsx");
          route("provider-information", "modules/ProviderInformation/ProviderInformation.page.tsx");
          route("announcements", "modules/Announcements/Announcements.page.tsx");
          route("news", "modules/News/News.page.tsx");
          route("news/:newsId", "modules/News/NewsDetails.page.tsx");
          route("profile/:id", "modules/Profile/Profile.page.tsx");
        });
        route("course/:courseId/lesson", "modules/Courses/Lesson/Lesson.layout.tsx", () => {
          route(":lessonId", "modules/Courses/Lesson/Lesson.page.tsx");
        });
        route("admin", "modules/Admin/Admin.layout.tsx", () => {
          route("courses", "modules/Admin/Courses/Courses.page.tsx", {
            index: true,
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
          route(
            "promotion-codes/:id",
            "modules/Admin/PromotionCodes/PromotionCodeDetails.page.tsx",
          );
        });
      });
    });
  });
};
