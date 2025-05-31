import { availableCoursesQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { Navigation } from "~/components/Navigation";
import { CoursesView } from "~/modules/Courses/CoursesView/CoursesView";

export const clientLoader = async () => {
  await queryClient.prefetchQuery(availableCoursesQueryOptions());

  return null;
}

export default function VisitorCoursesPage() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        <Navigation
          menuItems={[{
            label: "something",
            path: "/yolo",
            iconName: "Dashboard",
          },
          {
            label: "something else",
            path: "/yolo2",
            iconName: "Course",
          },]}
        />
        <main className="flex-1 overflow-y-auto bg-primary-50">
          <CoursesView />
        </main>
      </div>
    </div>
  )

}
