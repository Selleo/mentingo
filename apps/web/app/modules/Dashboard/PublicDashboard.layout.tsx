import { currentUserQueryOptions, useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { VideoProvider } from "~/components/VideoPlayer/VideoPlayerContext";
import { VideoPlayerSingleton } from "~/components/VideoPlayer/VideoPlayerSingleton";
import { Dashboard } from "~/modules/Dashboard/Dashboard";

export const clientLoader = async () => {
  await queryClient.fetchQuery(currentUserQueryOptions);

  return null;
};

export default function PublicDashboardLayout() {
  const { data: user } = useCurrentUser();

  const isAuthenticated = Boolean(user);

  return (
    <VideoProvider>
      <Dashboard isAuthenticated={isAuthenticated} />
      <VideoPlayerSingleton />
    </VideoProvider>
  );
}
