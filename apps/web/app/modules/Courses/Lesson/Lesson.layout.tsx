import { useCurrentUser } from "~/api/queries";
import { Dashboard } from "~/modules/Dashboard/Dashboard";

export default function LessonLayout() {
  const { data: user } = useCurrentUser();

  return <Dashboard isAuthenticated={Boolean(user)} />;
}
